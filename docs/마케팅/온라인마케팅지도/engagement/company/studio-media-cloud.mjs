// 작업실 영상 클라우드 (2026-11-16 유호님 「클라우드로 옮기기」 · 설계 3판 .tmp/company-media-cloud-20261116/설계.md, 비공개).
// 영상 원본은 미디어 버킷에 한 벌만 두고 studio-media 폴더는 읽기 캐시로 쓴다.
//   - 올리기: DB가 가리키는 이름(workspaceMediaNames) 가운데 장부에 없는 것을 뒤에서 하나씩 올린다. 쓰기 길은 바꾸지 않는다.
//   - 장부: 회사 DB 모음 studioMediaCloud(열쇠 diskName). verified만 백업이 가리키고, 받아 놓기와 비우기의 근거가 된다.
//   - 받아 놓기(ensureLocalMedia): 읽는 자리가 파일을 열기 전에 부른다. 로컬에 없고 장부가 verified면 버킷에서 받아 제자리에 놓는다.
//   - 비우기: 스위치가 evict일 때만, 캐시 상한을 넘으면 오래 안 쓴 verified 파일의 로컬 사본을 지운다.
//   - 지우기는 하지 않는다. 버킷의 객체는 PC 정리 작업(tools/작업실영상정리.js)만 지운다. 이 서버 계정에는 고치기·지우기 권한이 없다.
// 스위치: <데이터>/media-cloud-switch.json(소유자 이 프로세스, 0600, 링크 하나) {"mode":"off"|"upload"|"evict"|"hydrate","cacheBytes":n}.
// 없거나 못 읽으면 off다. off여도 받아 놓기와 하루 대조(읽기)는 돈다. 백업이 버킷을 가리킬지는 스위치가 아니라 장부로 정한다.
import {createHash,randomUUID} from 'node:crypto';
import {constants,lstatSync,unlinkSync} from 'node:fs';
import {lstat,mkdir,open,readFile,rename,statfs,unlink,readdir} from 'node:fs/promises';
import {join,resolve,dirname,basename} from 'node:path';
import {pipeline} from 'node:stream/promises';
import {Readable,Writable} from 'node:stream';
import {workspaceMediaNames} from './workspace-media.mjs';

export const MEDIA_CLOUD_KIND='studioMediaCloud';
export const SWITCH_FILE='media-cloud-switch.json';
export const MODES=Object.freeze(['off','upload','evict','hydrate']);
export const MEDIA_NAME=/^[a-f0-9-]{36}\.(mp4|webm|png|jpg|mp3|wav|srt|vtt|intake)$/;
const OBJECT_NAME=/^studio-media\/[a-f0-9-]{36}\.(?:mp4|webm|png|jpg|mp3|wav|srt|vtt|intake)(?:~[1-9][0-9]{0,3})?$/;
const BUCKET_NAME=/^synk-company-media-([0-9]{6,20})$/;
const EVICTABLE=new Set(['mp4','webm','png','jpg','mp3','wav','intake']);
const GiB=1024**3,DAY=86400000,BLOCK=1024*1024;
export const DEFAULTS=Object.freeze({cacheBytes:4*GiB,floorBytes:21*GiB,warnBytes:25*GiB,idleMs:14*DAY,urgentIdleMs:DAY,recentMs:DAY,minEvictBytes:256*1024,
  minCacheBytes:GiB,tickMs:60000,evictMs:10*60000,flushMs:10*60000,reconcileMs:DAY,firstReconcileMs:5*60000,fetchLeftoverMs:3600000,
  unreferencedLocalMs:3*DAY,staleObjectMs:40*DAY,cleanupStaleMs:7*DAY});

const fail=(message,status,code)=>Object.assign(new Error(message),{status,code});
const notFound=()=>fail('저장된 파일을 찾지 못했어요. 파일을 다시 올려 주세요.',404,'MEDIA_NOT_FOUND');
const busy=()=>fail('지금은 파일을 불러올 자리가 모자라요. 잠시 뒤 다시 해 주세요.',503,'MEDIA_FETCH_SPACE');
const stampOf=info=>({dev:Number(info.dev),ino:Number(info.ino),size:Number(info.size),mtimeMs:Math.trunc(Number(info.mtimeMs))});
const sameStamp=(a,b)=>!!a&&!!b&&a.dev===b.dev&&a.ino===b.ino&&a.size===b.size&&a.mtimeMs===b.mtimeMs;
const extensionOf=name=>name.slice(name.lastIndexOf('.')+1);
const NOFOLLOW=constants.O_NOFOLLOW||0;

// 한 저장 폴더에 클라우드 하나. 읽는 자리(다른 모듈)는 폴더만 알고 이 표로 찾는다 — 없으면(시험, 로컬 개발) 아무것도 하지 않는다.
const registry=new Map();
export function registerMediaCloud(directory,cloud){const key=resolve(directory);if(cloud)registry.set(key,cloud);else registry.delete(key);}
export function mediaCloudFor(directory){return registry.get(resolve(directory))||null;}
// 읽는 자리마다 파일을 열기 전에 부른다. 등록된 클라우드가 없으면 그대로 돌아간다(파일은 늘 로컬이다).
export async function ensureLocalMedia(directory,diskName){const cloud=mediaCloudFor(directory);if(cloud)await cloud.ensureLocal(diskName);}
// 바이트를 읽지 않고 「있다」만 묻는 자리(자료 목록): 로컬에 있거나 장부가 같은 크기로 verified면 있다.
export function mediaPresent(directory,diskName,byteSize){const cloud=mediaCloudFor(directory);return cloud?cloud.present(diskName,byteSize):null;}
// 해시만 필요한 자리(인물 해시): 장부가 verified면 그 sha256을 쓴다(로컬을 다시 읽지 않는다).
export function mediaLedgerSha(directory,diskName){const cloud=mediaCloudFor(directory);return cloud?cloud.ledgerSha(diskName):null;}

export function bucketForProject(projectNumber){const n=String(projectNumber||'').trim();if(!/^[0-9]{6,20}$/.test(n))throw fail('프로젝트 번호를 확인해 주세요.',500,'MEDIA_PROJECT_INVALID');return 'synk-company-media-'+n;}
export function validBucket(name){return BUCKET_NAME.test(String(name||''));}
export function validObject(name){return OBJECT_NAME.test(String(name||''));}

// 메타데이터 서버: 토큰과 프로젝트 번호. 토큰은 메모리에만 두고 만료 1분 전에 다시 받는다.
export function metadataCredentials({fetchImpl=fetch,base='http://169.254.169.254/computeMetadata/v1/',clock=Date.now}={}){
  let cached=null,project=null;
  async function get(path){const r=await fetchImpl(base+path,{headers:{'Metadata-Flavor':'Google'},redirect:'error',signal:AbortSignal.timeout(5000)});if(!r.ok)throw fail('메타데이터를 읽지 못했어요.',503,'MEDIA_METADATA_FAILED');return r;}
  return {
    async token(){if(cached&&cached.until>clock())return cached.value;const body=await (await get('instance/service-accounts/default/token')).json();
      if(typeof body?.access_token!=='string'||!/^[A-Za-z0-9._~+/-]+=*$/.test(body.access_token)||!(Number(body.expires_in)>0))throw fail('토큰을 확인해 주세요.',503,'MEDIA_TOKEN_INVALID');
      cached={value:body.access_token,until:clock()+(Number(body.expires_in)-60)*1000};return cached.value;},
    async bucket(){if(!project)project=bucketForProject((await (await get('project/numeric-project-id')).text()));return project;},
    async projectId(){const id=(await (await get('project/project-id')).text()).trim();if(!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(id))throw fail('프로젝트 ID를 확인해 주세요.',500,'MEDIA_PROJECT_INVALID');return id;}
  };
}

// GCS JSON API(필요한 것만). 같은 지역 VM과 버킷 사이라 망 요금이 없다.
// 요청마다 시간 제한을 건다(GPT 검수 GA5). 목록 · 조회 · 업로드 시작은 timeoutMs, 몸통을 흘리는 PUT과 받기는 크기를 최저 속도(minBytesPerSecond)로 나눈 시간과
// transferFloorMs 가운데 긴 쪽이다. 신호가 끊기면 fetch가 몸통 흐름까지 끊고, 부른 쪽이 임시 파일과 진행 표시를 치운다. 받기 · 올리기에 넘긴 signal은
// 서버가 멈출 때 진행 중인 요청을 끊는다(createMediaCloud의 stop).
export function gcsClient({credentials,fetchImpl=fetch,base='https://storage.googleapis.com',timeoutMs=60000,transferFloorMs=5*60000,minBytesPerSecond=1<<20}){
  const transferMs=size=>Math.max(transferFloorMs,Math.ceil(Number(size||0)/minBytesPerSecond)*1000);
  async function call(url,init={},{allow=[],timeout=timeoutMs,stop=null}={}){
    const token=await credentials.token();
    const signal=stop?AbortSignal.any([AbortSignal.timeout(timeout),stop]):AbortSignal.timeout(timeout);
    const r=await fetchImpl(url,{...init,headers:{...init.headers,authorization:'Bearer '+token},redirect:'error',signal});
    if(!r.ok){
      // 404·412를 허용한 호출도 상태만 쓴다. 스트림 정리가 늦거나 실패해도 받은 HTTP 상태를 전달한다.
      r.body?.cancel().catch(()=>{});
      if(!allow.includes(r.status))throw fail('미디어 버킷 요청이 실패했어요.',502,'MEDIA_GCS_'+r.status);
    }
    return r;
  }
  const objectUrl=(bucket,name)=>base+'/storage/v1/b/'+encodeURIComponent(bucket)+'/o/'+encodeURIComponent(name);
  const meta=row=>({name:row.name,generation:String(row.generation),size:Number(row.size),md5:row.md5Hash,created:row.timeCreated||null});
  return {
    async stat(bucket,name,generation){const r=await call(objectUrl(bucket,name)+'?fields=name,generation,size,md5Hash,timeCreated'+(generation?'&generation='+encodeURIComponent(generation):''),{},{allow:[404]});return r.status===404?null:meta(await r.json());},
    // 끝까지 흘린 뒤에야 객체가 생긴다. 이미 있으면(412) null을 돌려 부른 쪽이 stat으로 견준다. 몸통은 PUT 때에만 연다(FileHandle 스트림을 버리면 핸들이 닫힌다).
    async upload(bucket,name,{size,md5,body,signal=null}){
      const start=await call(base+'/upload/storage/v1/b/'+encodeURIComponent(bucket)+'/o?uploadType=resumable&ifGenerationMatch=0&fields=name,generation,size,md5Hash',{method:'POST',
        headers:{'content-type':'application/json; charset=UTF-8','x-upload-content-type':'application/octet-stream','x-upload-content-length':String(size)},body:JSON.stringify({name,md5Hash:md5})},{allow:[412],stop:signal});
      if(start.status===412)return null;
      const session=start.headers.get('location');if(!session||!session.startsWith(base+'/'))throw fail('업로드 주소를 확인해 주세요.',502,'MEDIA_GCS_SESSION');
      const done=await call(session,{method:'PUT',headers:{'content-length':String(size)},body:Readable.toWeb(body()),duplex:'half'},{allow:[412],timeout:transferMs(size),stop:signal});
      if(done.status===412)return null;return meta(await done.json());
    },
    async download(bucket,name,generation,writable,{size,signal=null}={}){const r=await call(objectUrl(bucket,name)+'?alt=media&generation='+encodeURIComponent(generation),{},{allow:[404],timeout:transferMs(size),stop:signal});if(r.status===404)return false;await pipeline(Readable.fromWeb(r.body),writable);return true;},
    async list(bucket,prefix){const out=[];let page='';do{const r=await call(base+'/storage/v1/b/'+encodeURIComponent(bucket)+'/o?prefix='+encodeURIComponent(prefix)+'&fields='+encodeURIComponent('nextPageToken,items(name,generation,size,md5Hash,timeCreated)')+(page?'&pageToken='+encodeURIComponent(page):''));
      const body=await r.json();for(const row of body.items||[])out.push(meta(row));page=body.nextPageToken||'';}while(page);return out;}
  };
}

async function digestsOf(handle,size){
  const sha=createHash('sha256'),md5=createHash('md5'),buffer=Buffer.allocUnsafe(BLOCK);let at=0;
  while(at<size){const {bytesRead}=await handle.read(buffer,0,Math.min(BLOCK,size-at),at);if(!bytesRead)throw fail('파일이 읽는 중에 줄었어요.',409,'MEDIA_CHANGED');sha.update(buffer.subarray(0,bytesRead));md5.update(buffer.subarray(0,bytesRead));at+=bytesRead;}
  return {sha256:sha.digest('hex'),md5:md5.digest('base64')};
}

// 경보 한 줄을 Cloud Logging에 남긴다(노드 계정에 logging.logWriter가 있다). 경보 규칙은 로그 이름 synk-media-cloud의 ERROR를 본다.
export function cloudLoggingAlert({credentials,fetchImpl=fetch,base='https://logging.googleapis.com'}){
  return async entry=>{const project=await credentials.projectId(),token=await credentials.token();
    const r=await fetchImpl(base+'/v2/entries:write',{method:'POST',redirect:'error',headers:{authorization:'Bearer '+token,'content-type':'application/json'},signal:AbortSignal.timeout(10000),
      body:JSON.stringify({logName:'projects/'+project+'/logs/synk-media-cloud',resource:{type:'global'},entries:[{severity:'ERROR',jsonPayload:{kind:'synk-media-cloud-alert',...entry}}]})});
    if(!r.ok)throw fail('경보를 남기지 못했어요.',502,'MEDIA_ALERT_FAILED');};
}

export function createMediaCloud({store,directory=store?.directory,credentials,gcs,clock=Date.now,options={},log=()=>{},namesOf=()=>workspaceMediaNames(store.db),draftNamesOf=null,alert=null}={}){
  if(!store||!directory)throw new Error('Media cloud requires a store.');
  const o={...DEFAULTS,...options},root=resolve(directory,'studio-media'),switchPath=join(resolve(directory),SWITCH_FILE);
  let abort=new AbortController();
  gcs=gcs||gcsClient({credentials});
  const lastUse=new Map(),inflight=new Map(),fetching=new Set(),failedAt=new Map();let bucketName=options.bucket||null,mode={mode:'off',cacheBytes:o.cacheBytes},modeReadAt=0,ticking=null,timers=[],stopped=false;
  const status={lastTickAt:null,lastUploadAt:null,lastErrorAt:null,lastError:null,lastReconcileAt:null,reconcile:null,lowSpace:false};
  const pathOf=name=>{if(!MEDIA_NAME.test(name))throw notFound();const path=resolve(root,name);if(dirname(path)!==root)throw notFound();return path;};
  const ledger=name=>store.get(MEDIA_CLOUD_KIND,name);
  const writeLedger=(name,row)=>store.put(MEDIA_CLOUD_KIND,name,{...row,diskName:name});
  async function bucket(){if(!bucketName)bucketName=await credentials.bucket();if(!validBucket(bucketName))throw fail('미디어 버킷 이름을 확인해 주세요.',500,'MEDIA_BUCKET_INVALID');return bucketName;}
  function noteError(error){status.lastErrorAt=new Date(clock()).toISOString();status.lastError=String(error?.code||error?.message||error).slice(0,120);log('media-cloud',status.lastError);}

  // 스위치는 1분마다 다시 읽는다. 링크, 다른 소유자, 0600이 아닌 파일, 깨진 JSON은 off다.
  // 읽는 중인 다른 호출은 같은 읽기를 기다린다. 읽은 시각은 다 읽은 뒤 적는다(카본 끝 판 B6).
  let modeReading=null;
  function readMode(){
    if(modeReadAt&&clock()-modeReadAt<o.tickMs/2)return Promise.resolve(mode);
    if(!modeReading)modeReading=readSwitch().then(next=>{mode=next;modeReadAt=clock();return mode;}).finally(()=>{modeReading=null;});
    return modeReading;
  }
  async function readSwitch(){
    try{const info=await lstat(switchPath);
      const owned=process.platform==='win32'||(info.uid===process.getuid?.()&&(info.mode&0o777)===0o600);
      if(!info.isFile()||info.nlink!==1||!owned||info.size>4096)throw new Error('switch');
      const body=JSON.parse(await readFile(switchPath,'utf8'));if(!MODES.includes(body?.mode))throw new Error('switch');
      const cacheBytes=body.cacheBytes==null?o.cacheBytes:Number(body.cacheBytes);if(!Number.isSafeInteger(cacheBytes)||cacheBytes<o.minCacheBytes||cacheBytes>1024*GiB)throw new Error('switch');
      return {mode:body.mode,cacheBytes};}
    catch{return {mode:'off',cacheBytes:o.cacheBytes};}
  }

  async function freeBytes(){const info=await statfs(root).catch(()=>statfs(resolve(directory)));return Number(info.bavail)*Number(info.bsize);}

  // 올리기 하나: 파일을 링크 없이 열어 sha256·md5를 재고 흘려 올린다. 앞뒤 도장이 같아야 장부에 적는다.
  async function uploadOne(name,{objectName='studio-media/'+name}={}){
    const path=pathOf(name),handle=await open(path,constants.O_RDONLY|NOFOLLOW);
    try{
      const before=await handle.stat();if(!before.isFile())throw fail('보통 파일이 아니에요.',409,'MEDIA_NOT_REGULAR');
      const size=Number(before.size),{sha256,md5}=await digestsOf(handle,size),target=await bucket();
      // 올리기 직전에 문서가 아직 이 이름을 가리키는지 다시 본다. 틱이 목록을 읽은 뒤 문서에서 뗀 파일(늦춘 지우기로 하루 남는 파일 — studio-media-trash.mjs)의 새 원격 사본을 만들지 않는다(GPT pulse-media-trash-20261127 GB2).
      // 올리는 중에 뗀 파일(그사이 디스크에서도 지워진 파일 포함)은 장부에 적는다 — 하루 대조가 끊긴 이름으로 세고 오래된 객체로 알린다(GPT pulse-media-trash-20261127-a GA1).
      if(!new Set(namesOf()).has(name))return 'unreferenced';
      const sent=await gcs.upload(target,objectName,{size,md5,body:()=>handle.createReadStream({start:0,autoClose:false,emitClose:false}),signal:abort.signal});
      // 연 핸들로 보낸 바이트는 그대로다. 올리는 사이 그 이름이 디스크에서 지워졌으면(ENOENT) 장부는 남긴다 — 장부 없는 원격 사본이 생기지 않게.
      const after=await handle.stat(),onDisk=await lstat(path).catch(error=>{if(error?.code==='ENOENT')return null;throw error;});
      if(!sameStamp(stampOf(before),stampOf(after))||onDisk&&!sameStamp(stampOf(before),stampOf(onDisk)))throw fail('올리는 중에 파일이 바뀌었어요.',409,'MEDIA_CHANGED');
      const remote=sent||await gcs.stat(target,objectName);
      // 이미 있던 객체가 이틀 넘었으면 받아들이지 않고 새 이름으로 올린다 — 장부 없이 남아 PC 정리의 후보가 됐을 수 있다(3판 검토 7-가).
      if(!sent&&remote&&remote.created&&clock()-Date.parse(remote.created)>2*DAY&&!/~[0-9]+$/.test(objectName)){
        let n=1;while(n<10000&&await gcs.stat(target,objectName+'~'+n))n++;
        return uploadOne(name,{objectName:objectName+'~'+n});
      }
      const base={object:objectName,bucket:target,bytes:size,sha256,md5,uploadedAt:new Date(clock()).toISOString(),localStamp:stampOf(before)};
      if(remote&&remote.size===size&&remote.md5===md5&&/^[0-9]+$/.test(remote.generation)){writeLedger(name,{...base,state:'verified',generation:remote.generation});status.lastUploadAt=base.uploadedAt;return 'verified';}
      writeLedger(name,{...base,state:'conflict',generation:remote?.generation||null});return 'conflict';
    }finally{await handle.close().catch(()=>{});}
  }

  // 받아 놓기: 장부가 verified일 때만. 임시 이름에 받아 대조한 뒤 원래 이름이 없을 때 rename으로 놓는다(링크 수는 늘 1).
  async function fetchOne(name,row,{urgentEvict=false}={}){
    const path=pathOf(name);
    const short=o.floorBytes-((await freeBytes())-row.bytes);
    if(short>0){if(urgentEvict)await evict({urgent:true,needBytes:short});if((await freeBytes())-row.bytes<o.floorBytes)throw busy();}
    await mkdir(root,{recursive:true,mode:0o700});  // 영상 폴더가 없는 복원 직후에도 받는다(카본 끝 판 B1)
    const temporary=join(root,'.fetch-'+randomUUID());fetching.add(basename(temporary));let handle;
    try{handle=await open(temporary,'wx',0o600);}catch(error){fetching.delete(basename(temporary));throw error;}let closed=false;
    try{
      const sha=createHash('sha256'),md5=createHash('md5');let bytes=0;
      const sink=new Writable({async write(chunk,_,done){try{sha.update(chunk);md5.update(chunk);bytes+=chunk.length;if(bytes>row.bytes)throw fail('받은 크기가 달라요.',502,'MEDIA_FETCH_MISMATCH');let at=0;while(at<chunk.length){const {bytesWritten}=await handle.write(chunk,at,chunk.length-at);at+=bytesWritten;}done();}catch(error){done(error);}}});
      const found=await gcs.download(row.bucket,row.object,row.generation,sink,{size:row.bytes,signal:abort.signal});
      if(!found){await handle.close().catch(()=>{});closed=true;await unlink(temporary).catch(()=>{});if(!(await occupied(path)))writeLedger(name,{...row,state:'lost',lostAt:new Date(clock()).toISOString()});return;}
      if(bytes!==row.bytes||sha.digest('hex')!==row.sha256||md5.digest('base64')!==row.md5)throw fail('받은 파일이 장부와 달라요.',502,'MEDIA_FETCH_MISMATCH');
      await handle.sync();await handle.close();closed=true;
      if(await occupied(path)){await unlink(temporary).catch(()=>{});return;}
      await rename(temporary,path);
      // 받는 사이에 고객이 지웠으면(문서가 먼저 빠지고 unlink는 ENOENT로 지나감) 놓은 파일을 같은 틱에서 지운다 — 지운 자료가 되살아나지 않게(3판 검토 1).
      // rename 뒤 같은 틱 전에 삭제가 돌아 이미 지워졌으면(ENOENT) 던지지 않고 돌아간다(카본 끝 판 B2).
      if(!new Set(namesOf()).has(name)){try{unlinkSync(path);}catch(error){if(error?.code!=='ENOENT')throw error;}return;}
      let placed;try{placed=lstatSync(path);}catch(error){if(error?.code==='ENOENT')return;throw error;}
      writeLedger(name,{...row,localStamp:stampOf(placed)});
    }catch(error){if(!closed)await handle.close().catch(()=>{});await unlink(temporary).catch(()=>{});throw error;}
    finally{fetching.delete(basename(temporary));}
  }
  async function exists(path){try{const info=await lstat(path);return info.isFile();}catch(error){if(error.code==='ENOENT')return false;throw error;}}
  // 그 자리에 무엇이든(파일 · 링크 · 폴더) 있거나 읽다 ENOENT 말고 다른 오류가 나면 「차 있음」 — 받지 않고 부른 쪽 검사에 맡긴다.
  async function occupied(path){try{await lstat(path);return true;}catch(error){return error?.code!=='ENOENT';}}

  async function ensureLocal(name){
    // 받을 것이 없으면 던지지 않고 돌아가 부른 쪽의 지금 처리(없음 404, 원본이 이상함 409, 검사의 missing)에 맡긴다. 이 규칙 밖의 이름(.upload 따위),
    // 그 자리에 이미 무언가 있는 경우, 장부가 verified가 아닌 경우, 버킷에 객체가 없는 경우(lost로 적음), 받는 중 지운 경우가 그렇다.
    // 그래서 장부가 빈 지금은 영상을 읽는 아홉 자리의 동작이 예전과 같다. 던지는 것은 받은 바이트가 다를 때(502)와 자리가 모자랄 때(503)뿐이다.
    if(typeof name!=='string'||!MEDIA_NAME.test(name))return;
    const path=pathOf(name);lastUse.set(name,clock());
    if(await occupied(path))return;
    const row=ledger(name);if(row?.state!=='verified')return;
    // 같은 이름의 동시 받기는 한 번만 한다 — 작업을 첫 await 전에 등록하고, 끝나면 자기가 등록한 작업일 때만 지운다(GPT 검수 GA2).
    let job=inflight.get(name);
    if(!job){const mine=(async()=>fetchOne(name,row,{urgentEvict:(await readMode()).mode==='evict'}))();job=mine;inflight.set(name,mine);
      mine.finally(()=>{if(inflight.get(name)===mine)inflight.delete(name);}).catch(()=>{});}
    await job;lastUse.set(name,clock());
  }
  function present(name,byteSize){
    try{const info=lstatSync(pathOf(name));if(info.isFile())return byteSize==null||Number(info.size)===byteSize;}catch{}
    const row=ledger(name);return row?.state==='verified'&&(byteSize==null||row.bytes===byteSize);
  }
  function ledgerSha(name){const row=ledger(name);return row?.state==='verified'?row.sha256:null;}

  // 비우기: 캐시 상한을 넘을 때만. 메타데이터를 대조한 뒤 같은 틱에서 다시 보고 unlinkSync한다.
  async function evict({urgent=false,needBytes=0}={}){
    const {mode:current,cacheBytes}=await readMode();if(current!=='evict')return {removed:0};
    const drafts=new Set(draftNamesOf?draftNamesOf():draftNames()),now=clock(),idle=urgent?o.urgentIdleMs:o.idleMs,cached=[];let total=0;
    for(const row of store.all(MEDIA_CLOUD_KIND)){
      const name=row?.diskName;if(!name||row.state!=='verified'||!MEDIA_NAME.test(name))continue;
      let info;try{info=lstatSync(pathOf(name));}catch{continue;}if(!info.isFile())continue;
      total+=Number(info.size);cached.push({name,row,info,used:Math.max(lastUse.get(name)||0,Date.parse(row.lastUsedAt||'')||0,Math.trunc(Number(info.mtimeMs)))});
    }
    if(!urgent&&total<=cacheBytes)return {removed:0,total};
    cached.sort((a,b)=>a.used-b.used);let removed=0,freed=0;
    for(const item of cached){
      if(!urgent&&total<=cacheBytes)break;
      if(urgent&&needBytes>0&&freed>=needBytes)break;  // 급한 비우기는 필요한 만큼만(카본 끝 판 B4)
      const {name,row,info}=item;
      if(!EVICTABLE.has(extensionOf(name))||Number(info.size)<o.minEvictBytes||drafts.has(name)||now-item.used<idle)continue;
      if(!sameStamp(stampOf(info),row.localStamp))continue;
      let remote;try{remote=await gcs.stat(row.bucket,row.object,row.generation);}catch(error){noteError(error);continue;}
      if(!remote||remote.generation!==row.generation||remote.size!==row.bytes||remote.md5!==row.md5)continue;
      // 여기부터 같은 틱: 대조 사이에 받아 놓기가 쓴 파일과 도장이 바뀐 파일은 두고 간다.
      const usedNow=lastUse.get(name)||0;if(clock()-usedNow<o.recentMs&&usedNow)continue;
      let again;try{again=lstatSync(pathOf(name));}catch{continue;}
      if(!sameStamp(stampOf(again),row.localStamp)||inflight.has(name))continue;
      unlinkSync(pathOf(name));total-=Number(again.size);freed+=Number(again.size);removed++;
    }
    return {removed,total};
  }
  function draftNames(){const out=[];for(const draft of store.all('clientDeliveryDrafts'))for(const item of draft?.items||[])if(item?.media?.diskName)out.push(item.media.diskName);return out;}

  // 쓰인 시각은 메모리에 모았다가 장부에 적는다(요청마다 DB를 쓰지 않는다).
  function flushUse(){for(const [name,at] of lastUse){const row=ledger(name);if(row&&Date.parse(row.lastUsedAt||'')!==at)writeLedger(name,{...row,lastUsedAt:new Date(at).toISOString()});}}

  async function tick(){
    if(ticking)return ticking;
    ticking=(async()=>{
      status.lastTickAt=new Date(clock()).toISOString();const {mode:current}=await readMode();if(current==='off')return {skipped:'off'};
      const names=namesOf(),began=clock(),uploaded=[];
      // 한 번에 45초 또는 20개까지 올린다(처음 172개 남짓을 몇 분에 채운다).
      // 파일 하나가 실패해도 다음 이름으로 간다. 실패한 이름은 10분 동안 다시 시도하지 않는다(카본 끝 판 B5).
      const failed=[],resting=name=>clock()-(failedAt.get(name)||-Infinity)<10*60000;
      for(const name of names){
        if(stopped||uploaded.length>=20||clock()-began>45000)break;if(!MEDIA_NAME.test(name)||resting(name))continue;const row=ledger(name);if(row)continue;
        try{if(await exists(pathOf(name))&&await uploadOne(name)!=='unreferenced')uploaded.push(name);}catch(error){noteError(error);failedAt.set(name,clock());failed.push(name);}
      }
      if(uploaded.length||failed.length)return {uploaded,...(failed.length?{failed}:{})};
      if(current==='hydrate'){
        for(const name of names){if(stopped||clock()-began>45000)break;if(!MEDIA_NAME.test(name)||resting(name))continue;const row=ledger(name);if(row?.state!=='verified')continue;
          try{if(await occupied(pathOf(name)))continue;await ensureLocal(name);if(await exists(pathOf(name)))return {hydrated:name,...(failed.length?{failed}:{})};}catch(error){noteError(error);failedAt.set(name,clock());failed.push(name);}}
        if(failed.length)return {failed};
      }
      return {idle:true};
    })().finally(()=>{ticking=null;});
    return ticking;
  }

  // 하루 대조: 버킷 목록과 DB가 가리키는 이름의 장부. 스위치가 off여도 읽기는 한다(장부가 비었으면 건너뛴다).
  // 하루 대조는 스위치와 상관없이 돈다. 없어진 객체를 같은 로컬 바이트로 다시 올리는 것도 고침이라 off에서도 한다(3판 검토 5).
  // 결과에 걸리는 것이 있으면 서버 쪽 경보(Cloud Logging)로 올린다 — PC 정리 작업이 멈춰도 서버가 알린다(3판 검토 2).
  async function reconcile(){
    const rows=new Map(store.all(MEDIA_CLOUD_KIND).filter(row=>row?.diskName).map(row=>[row.diskName,row]));
    const now=clock(),result={at:new Date(now).toISOString(),verified:0,verifiedBytes:0,missing:0,reuploaded:0,lost:0,stampDrift:0,stampFixed:0,conflict:0,unreferenced:0,localRemoved:0,staleObjects:0,lastCleanupAt:null,cleanupStale:false,freeBytes:null,lowSpace:false};
    try{result.freeBytes=await freeBytes();result.lowSpace=result.freeBytes<o.warnBytes;status.lowSpace=result.lowSpace;}catch{}
    // 장부가 비고 스위치가 off이면 경보를 내지 않는다 — 스위치가 없으면 바깥 호출이 하나도 없게(카본 끝 판 B3).
    if(!rows.size){status.reconcile=result;status.lastReconcileAt=result.at;if((await readMode()).mode!=='off')await raise(result);return result;}
    const target=await bucket(),listed=new Map((await gcs.list(target,'studio-media/')).map(item=>[item.name,item]));
    const referenced=new Set(namesOf());
    for(const [name,row] of rows){
      if(referenced.has(name)){if(row.unreferencedAt)writeLedger(name,{...ledger(name),unreferencedAt:null});continue;}
      // DB가 더 이상 가리키지 않는 이름: 끊긴 시각을 적고, 사흘 넘게 끊겼는데 로컬에 남은 사본은 지운다(지운 자료의 로컬 되살아남, 3판 검토 1).
      result.unreferenced++;const since=Date.parse(row.unreferencedAt||'');
      if(!since){writeLedger(name,{...row,unreferencedAt:result.at});continue;}
      if(now-since>o.unreferencedLocalMs){try{const info=lstatSync(pathOf(name));if(info.isFile()&&!inflight.has(name)){unlinkSync(pathOf(name));result.localRemoved++;}}catch{}}
      if(now-since>o.staleObjectMs&&listed.has(row.object))result.staleObjects++;
    }
    for(const name of referenced){
      const row=rows.get(name);if(!row)continue;if(row.state==='conflict'){result.conflict++;continue;}
      // 아직 가리키는 lost 줄은 회차마다 센다(하루 한 번 경보, GPT 검수 GA4). 로컬에 같은 바이트가 다시 있으면 새 이름으로 올려 되살린다.
      if(row.state==='lost'){const local=await lstat(pathOf(name)).catch(()=>null);
        if(local?.isFile()){const again=await rehash(name);if(again.sha256===row.sha256){try{const outcome=await uploadOne(name,{objectName:nextObject(row.object,listed)});if(outcome==='verified'){result.reuploaded++;continue;}if(outcome==='unreferenced')continue;}catch(error){noteError(error);}}}
        result.lost++;continue;}
      if(row.state!=='verified')continue;
      const remote=listed.get(row.object),local=await lstat(pathOf(name)).catch(()=>null);
      if(remote&&remote.generation===row.generation&&remote.size===row.bytes&&remote.md5===row.md5){result.verified++;result.verifiedBytes+=row.bytes;}
      else{
        // 목록만 믿지 않고 generation 고정으로 한 번 더 읽어 없을 때만 「없어짐」으로 본다(3판 검토 7-바).
        const pinned=await gcs.stat(row.bucket,row.object,row.generation).catch(error=>{noteError(error);return undefined;});
        if(pinned===undefined)continue;
        if(pinned&&pinned.size===row.bytes&&pinned.md5===row.md5){result.verified++;result.verifiedBytes+=row.bytes;continue;}
        result.missing++;
        if(local?.isFile()){
          const again=await rehash(name);
          if(again.sha256===row.sha256){try{const outcome=await uploadOne(name,{objectName:nextObject(row.object,listed)});if(outcome==='verified')result.reuploaded++;}catch(error){noteError(error);}}
          else if(again.missing){writeLedger(name,{...row,state:'lost',lostAt:result.at});result.lost++;}
          else if(again.sha256){writeLedger(name,{...row,state:'conflict'});result.conflict++;}
          // 잠깐 못 읽음(도장이 바뀜 · 읽기 오류): 내일 다시 본다(카본 끝 판 B7)
        }else{writeLedger(name,{...row,state:'lost',lostAt:result.at});result.lost++;}
        continue;}
      if(local?.isFile()&&!sameStamp(stampOf(local),row.localStamp)){result.stampDrift++;const again=await rehash(name);if(again.sha256===row.sha256){writeLedger(name,{...ledger(name),localStamp:again.stamp});result.stampFixed++;}else if(again.sha256){writeLedger(name,{...ledger(name),state:'conflict'});result.conflict++;}}
    }
    // PC 정리 작업은 돌 때마다 미디어 버킷 gc/runs/에 작은 기록을 남긴다. 한 번이라도 돈 뒤로 7일 넘게 새 기록이 없으면 경보다.
    try{const runs=(await gcs.list(target,'gc/runs/')).map(item=>Date.parse(item.created||'')).filter(Number.isFinite);
      if(runs.length){const last=Math.max(...runs);result.lastCleanupAt=new Date(last).toISOString();result.cleanupStale=now-last>o.cleanupStaleMs;}}catch(error){noteError(error);}
    status.reconcile=result;status.lastReconcileAt=result.at;await raise(result);return result;
  }
  // 경보: 하루 대조에서 걸린 것을 코드마다 하루 한 번 Cloud Logging에 ERROR로 남긴다(경보 규칙은 그 로그를 본다). 실패해도 대조는 멈추지 않는다.
  const raised=new Map();
  async function raise(result){
    const codes=[['MEDIA_LOST',result.lost],['MEDIA_CONFLICT',result.conflict],['MEDIA_STALE_OBJECTS',result.staleObjects],['MEDIA_CLEANUP_STALE',result.cleanupStale?1:0],['MEDIA_LOW_SPACE',result.lowSpace?1:0]].filter(([,n])=>n>0);
    for(const [code,count] of codes){if(clock()-(raised.get(code)||0)<DAY-60000)continue;raised.set(code,clock());
      try{await alert?.({code,count,at:result.at,freeBytes:result.freeBytes});}catch(error){noteError(error);}}
    return codes.map(([code])=>code);
  }
  // 다시 재기: {sha256, stamp}(다 읽음) · {missing:true}(파일 없음) · {transient:true}(보통 파일 아님 · 읽는 중 바뀜 · 다른 읽기 오류)를 나눠 돌려준다(카본 끝 판 B7).
  async function rehash(name){let handle;try{handle=await open(pathOf(name),constants.O_RDONLY|NOFOLLOW);const info=await handle.stat();if(!info.isFile())return {transient:true};const {sha256}=await digestsOf(handle,Number(info.size));const after=await handle.stat();return sameStamp(stampOf(info),stampOf(after))?{sha256,stamp:stampOf(info)}:{transient:true};}catch(error){return error?.code==='ENOENT'?{missing:true}:{transient:true};}finally{await handle?.close().catch(()=>{});}}
  function nextObject(object,listed){const base=object.replace(/~[0-9]+$/,'');for(let n=1;n<10000;n++){const name=base+'~'+n;if(!listed.has(name)&&name!==object)return name;}throw fail('새 객체 이름을 찾지 못했어요.',500,'MEDIA_OBJECT_EXHAUSTED');}

  // 서버 시작 때: 1시간 넘은 받기 임시 파일을 지운다(점으로 시작해 다른 코드의 이름 규칙에 걸리지 않는다).
  async function cleanLeftovers(){let names;try{names=await readdir(root);}catch{return 0;}let removed=0;
    for(const name of names){if(!/^\.fetch-[0-9a-f-]{36}$/.test(name)||fetching.has(name))continue;const path=join(root,name);try{const info=await lstat(path);if(info.isFile()&&clock()-Number(info.mtimeMs)>o.fetchLeftoverMs){await unlink(path);removed++;}}catch{}}
    return removed;}

  // 예약은 이름 있는 타이머 하나다(서버의 「허락된 예약만 돈다」 시험이 이름과 주기로 센다). 비우기 · 쓴 시각 적기 · 하루 대조는
  // 그 타이머가 흐른 시간(단조 시계)을 보고 차례가 된 것만 돌린다. 앞 회차가 아직 돌면 그 회차를 건너뛴다.
  const due={evict:0,flush:0,reconcile:0,leftovers:0};let beat=null;
  async function tickMediaCloud(now=performance.now()){
    if(stopped||beat)return beat;
    beat=(async()=>{
      await tick();
      if(now>=due.evict){due.evict=now+o.evictMs;await evict();}
      if(now>=due.flush){due.flush=now+o.flushMs;flushUse();}
      if(now>=due.leftovers){due.leftovers=now+o.fetchLeftoverMs;await cleanLeftovers();}
      if(now>=due.reconcile){due.reconcile=now+o.reconcileMs;await reconcile();}
    })().catch(noteError).finally(()=>{beat=null;});
    return beat;
  }
  function start(){
    stopped=false;if(abort.signal.aborted)abort=new AbortController();void cleanLeftovers();
    const now=performance.now();due.evict=now+o.evictMs;due.flush=now+o.flushMs;due.reconcile=now+o.firstReconcileMs;due.leftovers=now+o.fetchLeftoverMs;
    const t=setInterval(tickMediaCloud,o.tickMs);t.unref?.();timers.push(t);
    registerMediaCloud(directory,api);return api;
  }
  function stop(){stopped=true;for(const t of timers){clearInterval(t);clearTimeout(t);}timers=[];abort.abort();flushUse();registerMediaCloud(directory,null);}
  const api={ensureLocal,present,ledgerSha,tick,tickMediaCloud,evict,reconcile,flushUse,cleanLeftovers,start,stop,readMode,status:()=>({...status,mode:mode.mode}),uploadOne};
  return api;
}
