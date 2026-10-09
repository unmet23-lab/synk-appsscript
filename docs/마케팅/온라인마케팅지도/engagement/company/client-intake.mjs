import {readdir,readFile,lstat,mkdir,open,unlink} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {createRequire} from 'node:module';
import {randomUUID,createHash} from 'node:crypto';
const require=createRequire(import.meta.url);
const sync=require('../../../클라이언트_발주서_20260930/receiver/sync.cjs');
const validId=value=>typeof value==='string'&&/^p_[a-f0-9]{32}$/.test(value);
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const mime=name=>name.endsWith('.json')?'application/json':name.endsWith('.html')?'text/html':name.endsWith('.txt')||name.endsWith('.md')?'text/plain':'application/octet-stream';
function mediaPath(directory,file){if(!/^[a-f0-9-]{36}\.intake$/.test(file.diskName))throw fail('접수 자료를 찾을 수 없습니다.',404);return join(resolve(directory,'studio-media'),file.diskName);}
async function verifiedBytes(path,file){const info=await lstat(path);if(!info.isFile()||info.isSymbolicLink()||info.size!==file.size||info.size>30*1024*1024)throw fail('접수 자료의 무결성을 확인하지 못했습니다.',409);const bytes=await readFile(path);if(bytes.length!==file.size||digest(bytes)!==file.sha256)throw fail('접수 자료의 무결성을 확인하지 못했습니다.',409);return bytes;}
export async function discardIntakeFiles(receipt,directory){for(const file of receipt?.files||[])await unlink(mediaPath(directory,file)).catch(error=>{if(error.code!=='ENOENT')throw error;});}
export async function serveIntakeFile(req,res,directory,file,authorize){
  let bytes;try{bytes=await verifiedBytes(mediaPath(directory,file),{size:file.byteSize,sha256:file.sha256});}catch(error){if(error.code==='ENOENT')throw fail('저장된 접수 자료를 찾을 수 없습니다.',404);throw error;}
  authorize();
  res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':bytes.length,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cross-Origin-Resource-Policy':'same-origin','Content-Disposition':`attachment; filename="intake-file"; filename*=UTF-8''${encodeURIComponent(file.fileName).replace(/'/g,'%27')}`,'Content-Security-Policy':"default-src 'none'; sandbox"});
  res.end(req.method==='HEAD'?undefined:bytes);
}
export function createClientIntake({directory}){
  const verified=new WeakMap();
  async function load(id,verify=false){
    if(!directory||!validId(id))throw fail('접수를 찾을 수 없습니다.',404);
    const root=resolve(directory),folder=resolve(root,id);if(dirname(folder)!==root)throw fail('접수 경로를 확인해 주세요.');
    const info=await lstat(folder);if(!info.isDirectory()||info.isSymbolicLink())throw fail('접수 경로를 확인해 주세요.');
    const file=join(folder,'manifest.json'),stat=await lstat(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>1048576)throw fail('접수 기록을 확인해 주세요.');
    let manifest=JSON.parse(await readFile(file,'utf8'));
    if(manifest.schema!=='synk-intake-local-import'||manifest.submission_id!==id||manifest.download_verified!==true||!Array.isArray(manifest.files)||manifest.files.length>30||!Number.isFinite(Date.parse(manifest.received_at)))throw fail('동기화가 완료된 접수만 가져올 수 있습니다.');
    if(verify){
      if(!Array.isArray(manifest.artifacts)||manifest.artifacts.length!==sync.ARTIFACTS.length||!sync.ARTIFACTS.every(name=>manifest.artifacts.some(f=>f.name===name&&f.path===name)))throw fail('접수 원문을 확인해 주세요.');
      const all=[...manifest.artifacts,...manifest.files];
      if(all.some(f=>!Number.isSafeInteger(f.size)||f.size<0||f.size>30*1024*1024)||all.reduce((sum,f)=>sum+f.size,0)>176*1024*1024||manifest.files.some(f=>typeof f.name!=='string'||f.name.length>300||/[\u0000-\u001f\u007f]/.test(f.name)||typeof f.path!=='string'||!/^originals\/[^/\\]+$/.test(f.path)))throw fail('접수 자료의 크기와 경로를 확인해 주세요.');
      const checked=await sync.verifyCompleted(folder,{submissionId:id,receivedAt:manifest.received_at,fileCount:manifest.files.length});if(JSON.stringify(checked)!==JSON.stringify(manifest))throw fail('검증 중 접수 기록이 변경되었습니다. 다시 가져와 주세요.',409);manifest=checked;
    }
    return {id,receivedAt:manifest.received_at,fileCount:manifest.files.length,folder,manifest};
  }
  async function list(){if(!directory)return {receipts:[],available:false};let files;try{files=await readdir(directory,{withFileTypes:true});}catch(error){if(error.code==='ENOENT')return {receipts:[],available:false};throw fail('접수함을 읽을 수 없습니다.');}const receipts=[];for(const entry of files.slice(0,1000)){if(!entry.isDirectory()||!validId(entry.name))continue;try{const {folder,manifest,...row}=await load(entry.name);receipts.push(row);}catch{}}return {receipts:receipts.sort((a,b)=>b.receivedAt.localeCompare(a.receivedAt)),available:true};}
  async function read(id){
    try{
      const meta=await load(id,true),source=meta.manifest.artifacts.find(f=>f.name==='03_제작검토_전달서.json'),report=meta.manifest.artifacts.find(f=>f.name==='06_발주서.txt');
      const packet=JSON.parse((await verifiedBytes(join(meta.folder,source.path),source)).toString('utf8'));
      if(packet.schema!=='synk-production-handoff'||packet.submissionId!==id)throw fail('제작 전달서와 접수번호가 다릅니다.');
      const d=packet.clientProvided||{},receipt={id,receivedAt:meta.receivedAt,...Object.fromEntries(['subject','contact','responseContact','message','deadline','notes'].map(key=>[key,typeof d[key]==='string'?d[key].slice(0,2500):''])),reportText:(await verifiedBytes(join(meta.folder,report.path),report)).toString('utf8'),documents:[...meta.manifest.artifacts.map(f=>({...f,kind:'document'})),...meta.manifest.files.map(f=>({...f,kind:'attachment'}))].map(({name,size,sha256,kind})=>({fileName:name,byteSize:size,sha256,kind}))};
      verified.set(receipt,meta);return receipt;
    }catch{throw fail('접수 파일의 무결성을 확인하지 못했습니다. 기존 동기화 도구로 다시 확인해 주세요.',409);}
  }
  async function prepareFiles(receipt,storeDirectory){
    const meta=verified.get(receipt);if(!meta)throw fail('검증한 접수만 보관할 수 있습니다.',409);
    const prepared={...receipt,files:[]};
    try{
      await mkdir(resolve(storeDirectory,'studio-media'),{recursive:true,mode:0o700});
      for(const [index,source]of [...meta.manifest.artifacts,...meta.manifest.files].entries()){
        const bytes=await verifiedBytes(join(meta.folder,source.path),source),id=randomUUID(),file={id,diskName:id+'.intake',fileName:source.name,byteSize:bytes.length,mimeType:mime(source.name),sha256:source.sha256,kind:index<meta.manifest.artifacts.length?'document':'attachment'};
        const handle=await open(mediaPath(storeDirectory,file),'wx',0o600);prepared.files.push(file);try{await handle.writeFile(bytes);await handle.sync();}finally{await handle.close();}
      }
      verified.delete(receipt);return prepared;
    }catch(error){await discardIntakeFiles(prepared,storeDirectory);throw error;}
  }
  return {list,read,prepareFiles};
}
