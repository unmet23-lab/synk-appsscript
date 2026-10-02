import {readFile, writeFile, mkdir, rename, unlink, stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {Readable} from 'node:stream';
import {randomUUID, createHash} from 'node:crypto';
import path from 'node:path';

const API='https://www.googleapis.com/drive/v3';
const TOKEN='https://oauth2.googleapis.com/token';
const FILE_FIELDS='id,name,size,md5Checksum,parents,appProperties,trashed,mimeType';
const folderUrl=id=>`https://drive.google.com/drive/folders/${encodeURIComponent(id)}`;
const numeric=value=>value==null?null:Number(value);
export class DriveStorageError extends Error{
  constructor(status,publicMessage){super(publicMessage);this.name='DriveStorageError';this.status=status;this.publicMessage=publicMessage;}
}
const fail=(condition,status,message)=>{if(!condition)throw new DriveStorageError(status,message);};
const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{5,200}$/.test(id);

export function createDriveStorage({dataDir,fetchImpl=fetch}){
  const registryPath=path.join(path.resolve(dataDir),'drive-storage.json');
  const tokens=new Map();
  const refreshing=new Map();
  const verified=new Map();
  let serial=Promise.resolve();
  const exclusive=fn=>{const result=serial.then(fn,fn);serial=result.catch(()=>{});return result;};

  async function registry(){
    let text;
    try{text=await readFile(registryPath,'utf8');}
    catch(error){if(error.code==='ENOENT')return {version:1,installationId:null,activeConnectionId:null,connections:[]};throw new DriveStorageError(503,'Drive 저장소 설정을 읽을 수 없습니다. 로컬 백업과 파일 권한을 확인해 주세요.');}
    try{
      const result=JSON.parse(text);
      if(result.version!==1||!Array.isArray(result.connections)||typeof result.installationId!=='string')throw new Error();
      return result;
    }catch{throw new DriveStorageError(503,'Drive 저장소 설정이 손상되었습니다. 설정 파일을 복구해 주세요.');}
  }
  async function save(value,{beforeCommit}={}){
    await mkdir(path.dirname(registryPath),{recursive:true});
    const temp=`${registryPath}.${randomUUID()}.tmp`;
    try{await writeFile(temp,JSON.stringify(value,null,2),{mode:0o600});beforeCommit?.();await rename(temp,registryPath);}
    finally{await unlink(temp).catch(()=>{});}
  }
  function find(reg,id){
    const connection=reg.connections.find(c=>c.id===id);
    fail(connection&&validId(connection.folderId),503,'이 파일을 저장한 Google 계정 연결을 찾을 수 없습니다. 이전 연결을 복구해 주세요.');
    return connection;
  }
  const keyFor=c=>createHash('sha256').update(`${c.id}:${c.credentials.client_id}:${c.credentials.refresh_token}`).digest('hex');
  async function token(c){
    const key=keyFor(c),cached=tokens.get(key);
    if(cached&&cached.until>Date.now()+60000)return cached.value;
    if(refreshing.has(key))return refreshing.get(key);
    const pending=(async()=>{
      let response;
      try{response=await fetchImpl(TOKEN,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:c.credentials.client_id,client_secret:c.credentials.client_secret,refresh_token:c.credentials.refresh_token,grant_type:'refresh_token'}),redirect:'error',signal:AbortSignal.timeout(30000)});}
      catch{throw new DriveStorageError(503,'Google 인증 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.');}
      const body=await response.json().catch(()=>({}));
      fail(response.ok&&typeof body.access_token==='string',503,'Google 계정 인증이 만료되었거나 해제되었습니다. 이 계정을 다시 연결해 주세요.');
      tokens.set(key,{value:body.access_token,until:Date.now()+Number(body.expires_in||3600)*1000});
      return body.access_token;
    })();
    refreshing.set(key,pending);
    try{return await pending;}finally{refreshing.delete(key);}
  }
  async function request(c,url,{bodyFactory,timeoutMs=30000,...options}={}){
    for(let attempt=0;attempt<2;attempt++){
      let response,body;
      const accessToken=await token(c);
      try{
        body=bodyFactory?bodyFactory():options.body;
        response=await fetchImpl(url,{...options,body,headers:{...options.headers,Authorization:`Bearer ${accessToken}`},redirect:'error',signal:AbortSignal.timeout(timeoutMs),...(bodyFactory?{duplex:'half'}:{})});
      }catch{throw new DriveStorageError(503,'Google Drive 요청의 완료 여부를 확인하지 못했습니다. 연결을 확인하고 다시 시도해 주세요.');}
      finally{if(bodyFactory&&body?.destroy)body.destroy();}
      if(response.status===401&&attempt===0){await response.arrayBuffer().catch(()=>{});tokens.delete(keyFor(c));continue;}
      return response;
    }
  }
  async function checkedJson(response){
    if(response.ok)return response.json();
    const body=await response.json().catch(()=>({}));
    const reasons=(body.error?.errors||[]).map(e=>e.reason);
    if(reasons.includes('storageQuotaExceeded'))throw new DriveStorageError(507,'Google Drive 저장 공간이 부족합니다. 공간을 확보하거나 다른 연결 계정을 선택해 주세요.');
    if(response.status===429||reasons.some(r=>/rateLimit|dailyLimit/i.test(r)))throw new DriveStorageError(503,'Google Drive의 요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.');
    if(response.status===404)throw new DriveStorageError(404,'Google Drive에서 파일이나 전용 폴더를 찾을 수 없습니다.');
    if(response.status===401||response.status===403)throw new DriveStorageError(503,'Google Drive 접근 권한을 확인할 수 없습니다. 연결 계정을 확인해 주세요.');
    throw new DriveStorageError(503,'Google Drive가 요청을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  }
  async function account(c,{fresh=false}={}){
    const key=keyFor(c),cached=verified.get(key);
    if(!fresh&&cached&&cached.until>Date.now())return cached.result;
    const body=await checkedJson(await request(c,`${API}/about?fields=user(emailAddress,displayName),storageQuota`));
    fail(body.user?.emailAddress?.toLowerCase()===c.email.toLowerCase(),409,'Google 인증 계정이 저장된 연결 계정과 다릅니다. 계정 연결을 다시 확인해 주세요.');
    const result={email:body.user.emailAddress,name:body.user.displayName||body.user.emailAddress,limitBytes:numeric(body.storageQuota?.limit),usedBytes:numeric(body.storageQuota?.usage),driveBytes:numeric(body.storageQuota?.usageInDrive),trashBytes:numeric(body.storageQuota?.usageInDriveTrash)};
    verified.set(key,{until:Date.now()+60000,result});
    return result;
  }
  async function folder(reg,c){
    const meta=await checkedJson(await request(c,`${API}/files/${encodeURIComponent(c.folderId)}?fields=${FILE_FIELDS}`));
    fail(!meta.trashed&&meta.mimeType==='application/vnd.google-apps.folder'&&meta.appProperties?.synkMessengerSpaceId===reg.installationId,409,'메신저 전용 Drive 폴더가 이동되었거나 변경되었습니다. 저장소 연결을 확인해 주세요.');
    return meta;
  }
  async function file(reg,c,remoteId,fileId,{missingOkay=false}={}){
    fail(validId(remoteId)&&typeof fileId==='string',400,'Drive 파일 식별자가 올바르지 않습니다.');
    await account(c);
    const response=await request(c,`${API}/files/${encodeURIComponent(remoteId)}?fields=${FILE_FIELDS}`);
    if(response.status===404&&missingOkay){await response.arrayBuffer().catch(()=>{});return null;}
    const meta=await checkedJson(response);
    fail(meta.parents?.includes(c.folderId)&&meta.appProperties?.synkMessengerSpaceId===reg.installationId&&meta.appProperties?.synkMessengerFileId===fileId,409,'메신저가 만든 첨부파일인지 확인되지 않아 요청을 중단했습니다.');
    return meta;
  }
  async function active(){const reg=await registry();if(!reg.activeConnectionId)return null;const c=find(reg,reg.activeConnectionId);return {id:c.id,email:c.email,folderId:c.folderId};}
  async function status({fresh=false}={}){
    let reg;
    try{reg=await registry();}catch(error){return {provider:'google-drive',activeConnectionId:null,connections:[],status:'error',account:null,error:error.publicMessage,verifiedAt:null};}
    const result={provider:reg.activeConnectionId?'google-drive':'local',activeConnectionId:reg.activeConnectionId,connections:reg.connections.map(c=>({id:c.id,email:c.email,folderUrl:folderUrl(c.folderId),active:c.id===reg.activeConnectionId})),status:reg.activeConnectionId?'connected':'local',account:null,error:null,verifiedAt:null};
    if(!reg.activeConnectionId)return result;
    try{const c=find(reg,reg.activeConnectionId);result.account=await account(c,{fresh});await folder(reg,c);result.verifiedAt=new Date().toISOString();}
    catch(error){result.status='error';result.error=error.publicMessage||'Google Drive 연결 상태를 확인하지 못했습니다.';}
    return result;
  }
  async function trash({connectionId,remoteId,fileId}){
    const reg=await registry(),c=find(reg,connectionId);
    const meta=await file(reg,c,remoteId,fileId,{missingOkay:true});
    if(!meta||meta.trashed)return;
    await checkedJson(await request(c,`${API}/files/${encodeURIComponent(remoteId)}?fields=id,trashed`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({trashed:true})}));
  }
  async function upload({connectionId,localPath,name,size,md5,fileId}){
    const reg=await registry(),c=find(reg,connectionId);
    const a=await account(c);
    await folder(reg,c);
    fail((await stat(localPath)).size===size&&size>0&&size<=104857600,400,'업로드할 임시 파일의 크기가 올바르지 않습니다.');
    fail(/^[a-f0-9]{32}$/i.test(md5),400,'파일 검증값이 올바르지 않습니다.');
    if(a.limitBytes!==null&&a.usedBytes!==null)fail(a.limitBytes-a.usedBytes>=size,507,'Google Drive 저장 공간이 부족합니다.');
    const generated=await checkedJson(await request(c,`${API}/files/generateIds?count=1&space=drive&type=files`));
    const remoteId=generated.ids?.[0];
    fail(validId(remoteId),503,'Google Drive 파일 위치를 준비하지 못했습니다.');
    try{
      const initiation=await request(c,`https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=${FILE_FIELDS}`,{method:'POST',headers:{'Content-Type':'application/json','X-Upload-Content-Type':'application/octet-stream','X-Upload-Content-Length':String(size)},body:JSON.stringify({id:remoteId,name,mimeType:'application/octet-stream',parents:[c.folderId],appProperties:{synkMessengerSpaceId:reg.installationId,synkMessengerFileId:fileId}})});
      if(!initiation.ok)await checkedJson(initiation);
      const location=initiation.headers.get('location');
      let session;
      try{session=new URL(location);}catch{throw new DriveStorageError(503,'Google Drive 업로드 주소를 확인하지 못했습니다.');}
      fail(session.protocol==='https:'&&session.hostname==='www.googleapis.com'&&session.pathname.startsWith('/upload/drive/'),503,'허용되지 않은 업로드 주소여서 전송을 중단했습니다.');
      const uploaded=await request(c,session.href,{method:'PUT',headers:{'Content-Type':'application/octet-stream','Content-Length':String(size)},bodyFactory:()=>createReadStream(localPath),timeoutMs:300000});
      await checkedJson(uploaded);
      const meta=await file(reg,c,remoteId,fileId);
      fail(!meta.trashed&&Number(meta.size)===size&&meta.md5Checksum?.toLowerCase()===md5.toLowerCase(),502,'Drive에 저장된 파일이 원본과 일치하지 않습니다. 파일을 다시 올려 주세요.');
      verified.delete(keyFor(c));
      return {remoteId,connectionId,md5:meta.md5Checksum};
    }catch(error){
      // A pre-generated ID lets us safely locate even an upload whose final response was lost.
      try{await trash({connectionId,remoteId,fileId});}
      catch{error.remoteCleanup={connectionId,remoteId,fileId};}
      throw error;
    }
  }
  async function download({connectionId,remoteId,fileId,expectedSize,expectedMd5}){
    const reg=await registry(),c=find(reg,connectionId);
    const meta=await file(reg,c,remoteId,fileId);
    fail(!meta.trashed,404,'이 파일은 Google Drive 휴지통에 있습니다.');
    fail((expectedSize===undefined||Number(meta.size)===expectedSize)&&(!expectedMd5||meta.md5Checksum?.toLowerCase()===expectedMd5.toLowerCase()),409,'Drive에서 첨부파일 내용이 변경되었습니다. 원본을 확인한 뒤 다시 첨부해 주세요.');
    const response=await request(c,`${API}/files/${encodeURIComponent(remoteId)}?alt=media`,{timeoutMs:300000});
    if(!response.ok)await checkedJson(response);
    return Readable.fromWeb(response.body);
  }
  async function setActive(connectionId,{beforeCommit}={}){
    await exclusive(async()=>{
      const reg=await registry();
      if(connectionId!==null){const c=find(reg,connectionId);await account(c,{fresh:true});await folder(reg,c);}
      if(!reg.installationId)reg.installationId=randomUUID();
      reg.activeConnectionId=connectionId;
      await save(reg,{beforeCommit});
    });
    return status();
  }
  async function connectFromFile({sourcePath,expectedEmail}){
    fail(typeof expectedEmail==='string'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(expectedEmail),400,'연결할 Google 계정 이메일을 명시해 주세요.');
    let source;
    try{source=JSON.parse(await readFile(sourcePath,'utf8'));}catch{throw new DriveStorageError(400,'인증 파일을 읽을 수 없습니다. 파일 위치와 형식을 확인해 주세요.');}
    const raw=source.tokens?.default||source;
    const credentials={client_id:raw.client_id,client_secret:raw.client_secret,refresh_token:raw.refresh_token};
    fail(Object.values(credentials).every(v=>typeof v==='string'&&v.length>0),400,'client_id, client_secret, refresh_token이 있는 사용자 인증 파일이 필요합니다.');
    await exclusive(async()=>{
      const reg=await registry();
      const prior=reg.connections.find(c=>c.email.toLowerCase()===expectedEmail.toLowerCase()&&c.credentials.client_id===credentials.client_id);
      const c={id:prior?.id||randomUUID(),email:expectedEmail.toLowerCase(),folderId:prior?.folderId||null,credentials};
      await account(c,{fresh:true}); // Identity is checked BEFORE any Drive mutation.
      if(!reg.installationId){reg.installationId=randomUUID();await save(reg);}
      if(c.folderId){await folder(reg,c);}
      else{
        const q=`trashed = false and mimeType = 'application/vnd.google-apps.folder' and appProperties has { key='synkMessengerSpaceId' and value='${reg.installationId}' }`;
        const listed=await checkedJson(await request(c,`${API}/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=10`));
        if(listed.files?.length)c.folderId=listed.files[0].id;
        else{
          const created=await checkedJson(await request(c,`${API}/files?fields=id`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'SYNK 팀 메신저',mimeType:'application/vnd.google-apps.folder',appProperties:{synkMessengerSpaceId:reg.installationId}})}));
          c.folderId=created.id;
        }
        fail(validId(c.folderId),503,'메신저 전용 폴더를 준비하지 못했습니다.');
      }
      reg.connections=reg.connections.filter(item=>item.id!==c.id);
      reg.connections.push(c);
      reg.activeConnectionId=c.id;
      await save(reg);
    });
    return status({fresh:true});
  }
  return {active,status,upload,download,trash,setActive,connectFromFile};
}
