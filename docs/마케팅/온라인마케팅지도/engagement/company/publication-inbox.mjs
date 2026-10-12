import {randomUUID,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {mkdir,lstat,realpath,open,readdir,unlink} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import vm from 'node:vm';
import {createStudioService} from './studio-service.mjs';
import {validMediaSignature,STUDIO_MEDIA_LIMIT,commitStudioMedia,discardStudioMedia} from './studio-media.mjs';

const SETTINGS='publicationInboxSettings',RECEIPTS='publicationInboxEntries',LOCKS='publicationInboxLocks';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const SHA=/^[a-f0-9]{64}$/,SUBTITLE_LIMIT=256*1024,MANIFEST_LIMIT=64*1024,LEASE_MS=180000;
const CHANNELS=new Set(['youtube-shorts','instagram-reels','youtube-video']);
const fail=(message,status=400)=>Object.assign(new Error(message),{status,inboxSafe:true});
const digest=value=>createHash('sha256').update(value).digest('hex');
const subtitleContext=vm.createContext({Intl,TextEncoder});
vm.runInContext(readFileSync(new URL('./public/subtitle-lab.js',import.meta.url),'utf8'),subtitleContext);
const inspectSubtitles=vm.runInContext('subtitleInspect',subtitleContext);
const object=value=>{if(!value||typeof value!=='object'||Array.isArray(value))throw fail('전달 설명 파일의 형식을 확인해 주세요.');return value;};
function text(value,max,label,required=false){if(value==null&&!required)return '';if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))throw fail(`${label}을 ${max}자 이내로 입력해 주세요.`);const clean=value.trim();if(required&&!clean)throw fail(`${label}을 입력해 주세요.`);return clean;}
function manifestInput(raw,id){
  object(raw);if(raw.schema!==1||raw.deliveryId!==id||raw.confirmed!==true)throw fail('제작자가 확정한 전달 묶음인지 확인해 주세요.');
  if(typeof raw.finalizedAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.test(raw.finalizedAt)||!Number.isFinite(Date.parse(raw.finalizedAt)))throw fail('확정 시각에 시간대를 포함해 주세요.');
  const title=text(raw.title,100,'제목',true),body=text(raw.body,5000,'게시문'),language=text(raw.language||'ko',20,'자막 언어',true),mode=raw.mode||'adapt';
  if(!/^[a-z]{2,3}(?:-[a-z]{2,8})?$/.test(language))throw fail('자막 언어 코드를 확인해 주세요.');
  if(!['adapt','original'].includes(mode))throw fail('출력 방식을 확인해 주세요.');
  if(!Array.isArray(raw.channels)||!raw.channels.length||raw.channels.length>3||new Set(raw.channels).size!==raw.channels.length||raw.channels.some(id=>!CHANNELS.has(id)))throw fail('지원하는 게시 채널을 중복 없이 선택해 주세요.');
  if(raw.channels.includes('instagram-reels')&&body.length>2200)throw fail('Instagram 게시문은 2,200자 이내로 입력해 주세요.');
  let link=text(raw.link,2048,'자료 주소');if(link){let url;try{url=new URL(link);}catch{throw fail('자료 주소는 HTTPS로 입력해 주세요.');}if(url.protocol!=='https:'||url.username||url.password)throw fail('자료 주소는 자격증명 없는 HTTPS 주소여야 합니다.');link=url.href;}
  function file(value,names,limit){object(value);if(!names.includes(value.fileName)||!Number.isSafeInteger(value.byteSize)||value.byteSize<=0||value.byteSize>limit||!SHA.test(value.sha256))throw fail('전달 파일의 이름·크기·SHA256을 확인해 주세요.');return {fileName:value.fileName,byteSize:value.byteSize,sha256:value.sha256};}
  return {title,body,link,language,mode,channels:[...raw.channels],finalizedAt:new Date(raw.finalizedAt).toISOString(),video:file(raw.video,['video.mp4','video.webm'],STUDIO_MEDIA_LIMIT),subtitle:raw.subtitle?file(raw.subtitle,['subtitle.srt','subtitle.vtt'],SUBTITLE_LIMIT):null};
}

/** Local-only, explicitly enabled completed-file inbox. No external calls or publication. */
export function createPublicationInboxService({store,studio,clock=()=>new Date().toISOString(),enabled=false,directory=store.directory}={}){
  const root=resolve(directory,'publication-inbox'),mediaRoot=resolve(directory,'studio-media');let stopped=false,activeJob=null;
  const now=()=>new Date(clock()).toISOString();
  function current(user,write=false){const live=user?.id&&store.get('users',user.id);if(!live?.active)throw fail('먼저 로그인해 주세요.',401);if(write&&live.role==='viewer')throw fail('열람 계정은 완성본 자동 연결을 사용할 수 없습니다.',403);if(!UUID.test(live.id))throw fail('계정의 전달 폴더를 확인해 주세요.',403);return live;}
  function setting(user){return store.get(SETTINGS,user.id)||{id:user.id,ownerId:user.id,active:false,revision:0};}
  function userPath(user){return join(root,user.id);}
  function visible(row){return Object.fromEntries(['id','status','title','createdAt','updatedAt','message','productionId','versionId','finalizedAt'].filter(key=>row[key]!==undefined).map(key=>[key,row[key]]));}
  function state(user){user=current(user);const available=!!enabled&&user.role!=='viewer',config=setting(user);return {available,active:available&&config.active===true,...(available?{inboxPath:userPath(user)}:{}),entries:store.all(RECEIPTS).filter(row=>row.ownerId===user.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,100).map(visible),lastScanAt:config.lastScanAt||null,message:config.lastError||null};}
  async function safeDirectory(path,parent,{create=false}={}){
    if(create)await mkdir(path,{recursive:true,mode:0o700});const info=await lstat(path);
    if(!info.isDirectory()||info.isSymbolicLink())throw fail('전달 폴더의 바로가기·연결 경로는 사용할 수 없습니다.');
    const actual=await realpath(path);if(parent&&dirname(actual)!==await realpath(parent))throw fail('지정된 전달 폴더 내부 파일만 사용할 수 있습니다.');return actual;
  }
  async function ensure(user,{create=false}={}){await safeDirectory(root,directory,{create});await safeDirectory(userPath(user),root,{create});}
  async function configure(user,input,{authorize=()=>{}}={}){authorize();user=current(user,true);if(!enabled)throw fail('완성본 폴더 연결은 이 PC에서 실행한 작업실에서만 사용할 수 있습니다.',403);object(input);if(typeof input.active!=='boolean')throw fail('자동 연결 상태를 확인해 주세요.');if(input.active)await ensure(user,{create:true});authorize();user=current(user,true);if(stopped)throw fail('작업실을 종료하는 중입니다.',503);const old=setting(user);store.put(SETTINGS,user.id,{...old,active:input.active,revision:(old.revision||0)+1,updatedAt:now()});return state(user);}
  function readDraft(user,id){user=current(user,true);if(!enabled)throw fail('로컬 작업실에서 전달한 초안을 열어 주세요.',403);if(!UUID.test(id))throw fail('전달한 완성본을 찾을 수 없습니다.',404);const row=store.get(RECEIPTS,user.id+':'+id);if(!row?.draft||row.ownerId!==user.id)throw fail('전달한 완성본을 찾을 수 없습니다.',404);studio.assertEditable(user,row.productionId);return {draft:row.draft,production:studio.production(user,row.productionId).production};}
  function guard(user,revision,authorize=()=>{},token){if(stopped)throw fail('작업실 종료로 자동 연결을 멈췄습니다.',503);authorize();user=current(user,true);const config=setting(user);if(!enabled||!config.active||config.revision!==revision)throw fail('자동 연결이 꺼지거나 설정이 바뀌어 저장을 멈췄습니다.',409);if(token){const lock=store.get(LOCKS,user.id);if(lock?.token!==token||lock.expiresAt<=Date.now())throw fail('전달 작업의 유효 시간이 지나 다음 확인에서 다시 시도합니다.',409);}return user;}
  async function fileStamp(folder,name,limit,expected){const path=join(folder,name),info=await lstat(path);if(!info.isFile()||info.isSymbolicLink()||info.nlink>1||info.size<=0||info.size>limit||expected&&info.size!==expected.byteSize||dirname(await realpath(path))!==await realpath(folder))throw fail('전달 파일의 경로·크기가 바뀌었거나 허용 범위를 넘었습니다.');return [info.dev,info.ino,info.size,info.mtimeMs,info.ctimeMs];}
  async function sourceStamp(folder,input,manifestHash){return digest(JSON.stringify({manifestHash,video:await fileStamp(folder,input.video.fileName,STUDIO_MEDIA_LIMIT,input.video),subtitle:input.subtitle?await fileStamp(folder,input.subtitle.fileName,SUBTITLE_LIMIT,input.subtitle):null}));}
  async function safeFile(folder,name,limit,{expected,bytes=true}={}){
    const path=join(folder,name),before=await lstat(path);
    if(!before.isFile()||before.isSymbolicLink()||before.nlink>1||before.size<=0||before.size>limit||expected&&before.size!==expected.byteSize||dirname(await realpath(path))!==await realpath(folder))throw fail('전달 파일의 경로·크기가 바뀌었거나 허용 범위를 넘었습니다.');
    const handle=await open(path,'r'),chunks=[],hasher=createHash('sha256');let size=0;
    try{const opened=await handle.stat();if(opened.dev!==before.dev||opened.ino!==before.ino||opened.size!==before.size)throw fail('읽는 중 전달 파일이 바뀌었습니다.');const buffer=Buffer.alloc(1024*1024);while(true){const {bytesRead}=await handle.read(buffer,0,buffer.length,null);if(!bytesRead)break;size+=bytesRead;if(size>limit||size>before.size)throw fail('읽는 중 전달 파일이 바뀌었습니다.');hasher.update(buffer.subarray(0,bytesRead));if(bytes)chunks.push(Buffer.from(buffer.subarray(0,bytesRead)));}const after=await handle.stat(),onDisk=await lstat(path);if(size!==before.size||after.size!==before.size||after.mtimeMs!==before.mtimeMs||after.ctimeMs!==before.ctimeMs||onDisk.isSymbolicLink()||onDisk.ino!==before.ino||onDisk.dev!==before.dev||onDisk.mtimeMs!==before.mtimeMs||dirname(await realpath(path))!==await realpath(folder))throw fail('읽는 중 전달 파일이 바뀌었습니다.');}finally{await handle.close();}
    const sha256=hasher.digest('hex');if(expected&&sha256!==expected.sha256)throw fail('전달 파일의 SHA256이 확정 당시와 다릅니다. 새 전달 묶음을 만들어 주세요.');return {bytes:bytes?Buffer.concat(chunks):null,sha256};
  }
  async function cleanupPending(lock){
    // A crash may leave only this job's reserved media. Never delete source inbox files.
    if(!lock?.pendingMedia?.length)return;
    try{await safeDirectory(mediaRoot,directory);}catch(error){if(error.code==='ENOENT')return;throw error;}
    for(const id of lock?.pendingMedia||[]){if(!UUID.test(id)||store.get('studioMedia',id))continue;for(const extension of ['upload','mp4','webm']){const path=join(mediaRoot,id+'.'+extension);try{const info=await lstat(path);if(info.isFile()&&!info.isSymbolicLink())await unlink(path);}catch(error){if(error.code!=='ENOENT')throw error;}}}
  }
  function acquire(user,revision){return store.transaction(()=>{const previous=store.get(LOCKS,user.id);if(previous&&previous.expiresAt>Date.now())return null;const lock={id:user.id,ownerId:user.id,token:randomUUID(),revision,expiresAt:Date.now()+LEASE_MS,pendingMedia:[]};store.put(LOCKS,user.id,lock);return {lock,previous};});}
  function renew(user,token){const lock=store.get(LOCKS,user.id);if(lock?.token!==token)return false;store.put(LOCKS,user.id,{...lock,expiresAt:Date.now()+LEASE_MS});return true;}
  function reserve(user,token,id){const lock=store.get(LOCKS,user.id);if(lock?.token!==token)throw fail('전달 확인을 다시 시도해 주세요.',409);store.put(LOCKS,user.id,{...lock,pendingMedia:[...(lock.pendingMedia||[]),id],expiresAt:Date.now()+LEASE_MS});}
  function saveError(user,id,error,old){const key=user.id+':'+id,at=now(),row=old||{id,ownerId:user.id,title:'확정본 전달',createdAt:at};store.put(RECEIPTS,key,{...row,status:'error',updatedAt:at,message:old?.draft?'전달 폴더가 변경됐습니다. 기존 완성본·초안은 보존했습니다. 새 전달 묶음으로 다시 보내 주세요.':error.inboxSafe?error.message:'전달 파일을 읽지 못했습니다. 파일을 닫고 확정본 전달을 다시 실행해 주세요.'});}
  function stagedStudio(){const writes=new Map();const staged={get:(kind,id)=>writes.get(kind+'\0'+id)?.body??store.get(kind,id),all:kind=>{const rows=new Map(store.all(kind).map(row=>[row.id,row]));for(const row of writes.values())if(row.kind===kind)rows.set(row.id,row.body);return [...rows.values()];},put:(kind,id,body)=>{writes.set(kind+'\0'+id,{kind,id,body});return body;},transaction:fn=>fn()};return {service:createStudioService({store:staged,clock}),writes};}
  async function importOne(user,id,revision,authorize,token){
    const folder=join(userPath(user),id),key=user.id+':'+id;let upload=null,committed=false,old=store.get(RECEIPTS,key);
    try{
      guard(user,revision,authorize,token);await ensure(user);await safeDirectory(folder,userPath(user));
      let manifest;try{manifest=await safeFile(folder,'ready.json',MANIFEST_LIMIT);}catch(error){if(error.code==='ENOENT')return;throw error;}
      let raw;try{raw=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(manifest.bytes));}catch{throw fail('ready.json이 올바른 UTF-8 JSON 파일인지 확인해 주세요.');}
      const input=manifestInput(raw,id),stamp=await sourceStamp(folder,input,manifest.sha256);
      if(old?.draft&&old.sourceStamp===stamp){guard(user,revision,authorize,token);if(old.status==='error')store.put(RECEIPTS,key,{...old,status:old.duplicateOf?'duplicate':'ready',message:old.duplicateOf?'이미 등록한 동일한 완성본·초안을 연결했습니다.':'작업실 완성본과 게시 초안을 준비했습니다.',updatedAt:now()});return;}
      const video=await safeFile(folder,input.video.fileName,STUDIO_MEDIA_LIMIT,{expected:input.video,bytes:!old?.draft}),mimeType=input.video.fileName.endsWith('.mp4')?'video/mp4':'video/webm';
      const subtitle=input.subtitle?await safeFile(folder,input.subtitle.fileName,SUBTITLE_LIMIT,{expected:input.subtitle}):null;
      let subtitleText='';if(subtitle){try{subtitleText=new TextDecoder('utf-8',{fatal:true}).decode(subtitle.bytes).trim();}catch{throw fail('자막을 UTF-8 SRT·VTT 파일로 저장해 주세요.');}if(!subtitleText||inspectSubtitles(subtitleText,{fileName:input.subtitle.fileName}).errors)throw fail('자막 시간과 형식 오류를 고친 뒤 다시 전달해 주세요.');}
      const fingerprint=digest(JSON.stringify({...input,finalizedAt:undefined,subtitleText}));
      guard(user,revision,authorize,token);
      if(old?.draft){if(old.fingerprint!==fingerprint)throw fail('같은 전달 ID의 내용이 바뀌었습니다.');store.put(RECEIPTS,key,{...old,sourceStamp:stamp,status:old.duplicateOf?'duplicate':'ready',message:old.duplicateOf?'이미 등록한 동일한 완성본·초안을 연결했습니다.':'작업실 완성본과 게시 초안을 준비했습니다.',updatedAt:now()});return;}
      if(!validMediaSignature(mimeType,video.bytes.subarray(0,4096)))throw fail('전달한 영상 내용이 MP4·WebM 형식과 다릅니다.');
      const same=store.all(RECEIPTS).find(row=>row.ownerId===user.id&&row.draft&&row.fingerprint===fingerprint);
      if(same){studio.assertEditable(user,same.productionId);store.put(RECEIPTS,key,{...same,id,ownerId:user.id,sourceStamp:stamp,duplicateOf:same.id,status:'duplicate',createdAt:now(),updatedAt:now(),finalizedAt:input.finalizedAt,message:'이미 등록한 동일한 완성본·초안을 연결했습니다.'});return;}
      await safeDirectory(mediaRoot,directory,{create:true});guard(user,revision,authorize,token);
      const mediaId=randomUUID(),extension=mimeType==='video/mp4'?'mp4':'webm';reserve(user,token,mediaId);
      upload={temporary:join(mediaRoot,mediaId+'.upload'),metadata:{id:mediaId,diskName:mediaId+'.'+extension,mimeType,fileName:input.video.fileName,byteSize:video.bytes.length,sha256:video.sha256}};
      const output=await open(upload.temporary,'wx',0o600);try{await output.writeFile(video.bytes);await output.sync();}finally{await output.close();}
      await safeFile(folder,input.video.fileName,STUDIO_MEDIA_LIMIT,{expected:input.video,bytes:false});if(input.subtitle)await safeFile(folder,input.subtitle.fileName,SUBTITLE_LIMIT,{expected:input.subtitle,bytes:false});
      const again=await safeFile(folder,'ready.json',MANIFEST_LIMIT);if(again.sha256!==manifest.sha256||await sourceStamp(folder,input,again.sha256)!==stamp)throw fail('저장하는 중 전달 파일이 바뀌었습니다.');
      await ensure(user);await safeDirectory(folder,userPath(user));await safeDirectory(mediaRoot,directory);guard(user,revision,authorize,token);await commitStudioMedia(upload,directory);
      // Studio's validation is reused against a buffered writer so all three
      // documents commit together despite addMedia's own transaction boundary.
      const staged=stagedStudio(),production=staged.service.saveProduction(user,{title:input.title,stage:'ready',nextAction:'자동으로 연결한 영상·자막·게시문을 확인하고 게시 묶음을 만드세요.'}).production;
      const added=staged.service.addMedia(user,production.id,upload.metadata,'자동으로 연결한 확정본').production,versionId=added.versions.at(-1).id;
      const draft={productionId:production.id,versionId,title:input.title,body:input.body,link:input.link,language:input.language,channels:input.channels,mode:input.mode,subtitleText,subtitleFileName:input.subtitle?.fileName||''};
      const receipt={id,ownerId:user.id,status:'ready',title:input.title,createdAt:now(),updatedAt:now(),finalizedAt:input.finalizedAt,productionId:production.id,versionId,draft,fingerprint,sourceStamp:stamp,message:'작업실 완성본과 게시 초안을 준비했습니다.'};
      store.transaction(()=>{guard(user,revision,authorize,token);for(const row of staged.writes.values())store.put(row.kind,row.id,row.body);store.put(RECEIPTS,key,receipt);});committed=true;
    }catch(error){try{guard(user,revision,authorize,token);saveError(user,id,error,old);}catch{} }
    finally{if(upload&&!committed)await discardStudioMedia(upload,directory).catch(()=>{});}
  }
  async function scanUser(user,authorize){
    user=current(user,true);const config=setting(user);if(!config.active)return;guard(user,config.revision,authorize);
    const acquired=acquire(user,config.revision);if(!acquired)return;const {lock,previous}=acquired;
    const heartbeat=setInterval(()=>{try{guard(user,config.revision,authorize,lock.token);renew(user,lock.token);}catch{}},30000);heartbeat.unref?.();
    try{await cleanupPending(previous);await ensure(user,{create:true});const folders=(await readdir(userPath(user),{withFileTypes:true})).filter(row=>UUID.test(row.name)).sort((a,b)=>a.name.localeCompare(b.name));
      // Rotate through a bounded batch so old receipts cannot starve a busy inbox.
      const after=folders.findIndex(row=>row.name>(config.cursor||'')),start=after<0?0:after,selected=[...folders.slice(start),...folders.slice(0,start)].slice(0,100);let cursor=config.cursor||'';
      for(const folder of selected){guard(user,config.revision,authorize,lock.token);await importOne(user,folder.name,config.revision,authorize,lock.token);cursor=folder.name;}
      guard(user,config.revision,authorize,lock.token);store.put(SETTINGS,user.id,{...setting(user),cursor,lastScanAt:now(),lastError:null});
    }catch(error){const live=store.get('users',user.id),configNow=setting(user);if(!stopped&&live?.active&&live.role!=='viewer'&&configNow.active&&configNow.revision===config.revision)store.put(SETTINGS,user.id,{...configNow,lastScanAt:now(),lastError:error.inboxSafe?error.message:'전달 폴더를 확인하지 못했습니다. 폴더 연결과 접근 권한을 확인해 주세요.'});throw error;
    }finally{clearInterval(heartbeat);const live=store.get(LOCKS,user.id);if(live?.token===lock.token){await cleanupPending(live);store.remove(LOCKS,user.id);}}
  }
  function scan({user,authorize=()=>{}}={}){
    if(user){authorize();current(user,true);}if(stopped||!enabled)return Promise.resolve(user?state(user):undefined);
    if(activeJob)return activeJob.catch(()=>{}).then(()=>{if(user){authorize();return state(user);}});
    activeJob=(async()=>{const users=user?[current(user,true)]:store.all(SETTINGS).filter(row=>row.active).map(row=>store.get('users',row.ownerId)).filter(row=>row?.active&&row.role!=='viewer');
      for(const person of users){try{await scanUser(person,user?authorize:()=>{});}catch(error){if(user)throw error;}}
      return user?state(user):undefined;
    })().finally(()=>{activeJob=null;});return activeJob;
  }
  const waitForIdle=()=>activeJob||Promise.resolve();
  async function stop(){stopped=true;await waitForIdle();}
  return {configure,state,readDraft,scan,waitForIdle,stop};
}
