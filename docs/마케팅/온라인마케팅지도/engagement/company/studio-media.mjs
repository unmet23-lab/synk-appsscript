import {randomUUID} from 'node:crypto';
import {mkdir,open,rename,unlink,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {pipeline} from 'node:stream/promises';

export const STUDIO_MEDIA_LIMIT=100*1024*1024;
const types={'video/mp4':'mp4','video/webm':'webm','image/png':'png','image/jpeg':'jpg'};
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const directory=storeDirectory=>resolve(storeDirectory,'studio-media');
function located(storeDirectory,name){const root=directory(storeDirectory);if(!/^[a-f0-9-]{36}\.(?:mp4|webm|png|jpg|upload)$/.test(name))throw fail('저장된 미디어 경로를 확인해 주세요.',404);const path=resolve(root,name);if(dirname(path)!==root)throw fail('미디어를 찾을 수 없습니다.',404);return path;}
function header(req,key,max,fallback){const raw=req.headers[key];if(raw==null)return fallback;let decoded;try{decoded=decodeURIComponent(raw);}catch{throw fail('파일 이름과 버전 이름의 인코딩을 확인해 주세요.');}if(typeof decoded!=='string'||!decoded.trim()||decoded.length>max||/[\u0000-\u001f\u007f]/.test(decoded))throw fail('파일 이름과 버전 이름을 확인해 주세요.');return decoded.trim().replace(/[\\/]/g,'_');}
export function validMediaSignature(mime,head){
  if(mime==='image/png')return head.length>=8&&head.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if(mime==='image/jpeg')return head.length>=3&&head[0]===255&&head[1]===216&&head[2]===255;
  if(mime==='video/mp4')return head.length>=12&&head.subarray(4,8).toString('ascii')==='ftyp'&&head.readUInt32BE(0)>=12&&head.readUInt32BE(0)<=head.length;
  if(mime==='video/webm')return head.length>=8&&head.subarray(0,4).equals(Buffer.from([26,69,223,163]))&&head.includes(Buffer.from('webm'));
  return false;
}
export async function receiveStudioMedia(req,storeDirectory){
  const mimeType=String(req.headers['content-type']||'').split(';')[0].trim().toLowerCase(),extension=types[mimeType];
  if(!extension)throw fail('MP4·WebM 영상, PNG·JPEG 이미지만 올릴 수 있습니다.',415);
  if(Number(req.headers['content-length'])>STUDIO_MEDIA_LIMIT)throw fail('파일은 100MiB 이하여야 합니다.',413);
  const id=randomUUID(),fileName=header(req,'x-file-name',200,`upload.${extension}`),label=header(req,'x-version-label',100,'업로드한 완성본');
  const suppliedExtension=fileName.split('.').pop().toLowerCase();if(![extension,...(extension==='jpg'?['jpeg']:[])].includes(suppliedExtension))throw fail('파일 확장자와 영상·이미지 형식이 일치해야 합니다.',415);
  await mkdir(directory(storeDirectory),{recursive:true,mode:0o700});const temporary=located(storeDirectory,id+'.upload'),handle=await open(temporary,'wx',0o600);let size=0,head=Buffer.alloc(0);
  try{
    for await(const chunk of req.iterator({destroyOnReturn:false})){
      size+=chunk.length;if(size>STUDIO_MEDIA_LIMIT){req.resume();throw fail('파일은 100MiB 이하여야 합니다.',413);}
      if(head.length<4096)head=Buffer.concat([head,chunk.subarray(0,4096-head.length)]);
      let offset=0;while(offset<chunk.length){const {bytesWritten}=await handle.write(chunk,offset,chunk.length-offset);offset+=bytesWritten;}
    }
    if(!size||!validMediaSignature(mimeType,head))throw fail('파일 내용이 선택한 영상·이미지 형식과 다릅니다.',415);
    await handle.close();return {temporary,metadata:{id,diskName:id+'.'+extension,mimeType,fileName,byteSize:size},label};
  }catch(error){await handle.close().catch(()=>{});await unlink(temporary).catch(()=>{});throw error;}
}
export async function commitStudioMedia(upload,storeDirectory){const final=located(storeDirectory,upload.metadata.diskName);await rename(upload.temporary,final);upload.committed=true;return upload.metadata;}
export async function discardStudioMedia(upload,storeDirectory){if(!upload)return;const path=upload.committed?located(storeDirectory,upload.metadata.diskName):located(storeDirectory,upload.metadata.id+'.upload');await unlink(path).catch(error=>{if(error.code!=='ENOENT')throw error;});}
export function mediaRange(headerValue,size){
  if(!headerValue)return null;const m=/^bytes=(\d*)-(\d*)$/.exec(headerValue);if(!m||(!m[1]&&!m[2]))throw fail('요청한 미디어 범위를 제공할 수 없습니다.',416);
  let start,end;if(!m[1]){const suffix=Number(m[2]);if(!Number.isSafeInteger(suffix)||suffix<=0)throw fail('미디어 범위를 확인해 주세요.',416);start=Math.max(0,size-suffix);end=size-1;}else{start=Number(m[1]);end=m[2]?Number(m[2]):size-1;}
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=size||end<start)throw fail('미디어 범위를 확인해 주세요.',416);return {start,end:Math.min(end,size-1)};
}
export async function serveStudioMedia(req,res,storeDirectory,media,authorize=()=>{}){
  const path=located(storeDirectory,media.diskName);let info;try{info=await stat(path);}catch{throw fail('저장된 미디어 파일을 찾을 수 없습니다.',404);}if(!info.isFile()||!types[media.mimeType])throw fail('미디어를 찾을 수 없습니다.',404);
  authorize();
  let range;try{range=mediaRange(req.headers.range,info.size);}catch(error){if(error.status===416){res.writeHead(416,{'Content-Range':`bytes */${info.size}`,'Cache-Control':'private, no-store'});res.end();return;}throw error;}
  const headers={'Content-Type':media.mimeType,'Content-Length':range?range.end-range.start+1:info.size,'Accept-Ranges':'bytes','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cross-Origin-Resource-Policy':'same-origin','Content-Disposition':`inline; filename="studio-media.${types[media.mimeType]}"; filename*=UTF-8''${encodeURIComponent(media.fileName).replace(/'/g,'%27')}`,'Content-Security-Policy':"default-src 'none'; sandbox"};
  if(range)headers['Content-Range']=`bytes ${range.start}-${range.end}/${info.size}`;
  res.writeHead(range?206:200,headers);if(req.method==='HEAD'){res.end();return;}
  try{await pipeline(createReadStream(path,range||{}),res);}catch{res.destroy();}
}
