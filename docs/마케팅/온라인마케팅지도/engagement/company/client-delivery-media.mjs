import {randomUUID} from 'node:crypto';
import {mkdir,writeFile,rename,unlink,lstat,readFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import vm from 'node:vm';
import {receiveStudioMedia,commitStudioMedia,discardStudioMedia,serveStudioMedia,mediaRange} from './studio-media.mjs';

export const DELIVERY_SUBTITLE_LIMIT=256*1024;
const subtitleTypes={'application/x-subrip':'srt','text/vtt':'vtt'};
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const context=vm.createContext({Intl,TextEncoder});
vm.runInContext(readFileSync(new URL('./public/subtitle-lab.js',import.meta.url),'utf8'),context);
const inspect=vm.runInContext('subtitleInspect',context);
function located(directory,name){const root=resolve(directory,'studio-media'),path=resolve(root,name);if(!/^[a-f0-9-]{36}\.(?:srt|vtt|upload)$/.test(name)||dirname(path)!==root)throw fail('자막 파일을 찾을 수 없습니다.',404);return path;}
function header(req,key,max,fallback=''){let value;try{value=decodeURIComponent(req.headers[key]??fallback);}catch{throw fail('파일 이름의 인코딩을 확인해 주세요.');}if(!value.trim()||value.length>max||/[\u0000-\u001f\u007f]/.test(value))throw fail('파일과 버전 이름을 확인해 주세요.');return value.trim().replace(/[\\/]/g,'_');}
export async function receiveDeliveryMedia(req,directory){
  const fileName=header(req,'x-file-name',200,'upload'),extension=fileName.split('.').pop().toLowerCase();
  if(!['srt','vtt'].includes(extension))return receiveStudioMedia(req,directory,{maxLabelLength:120});
  const supplied=String(req.headers['content-type']||'').split(';')[0].trim().toLowerCase(),mimeType=extension==='srt'?'application/x-subrip':'text/vtt';
  if(!['','application/octet-stream','text/plain',mimeType].includes(supplied))throw fail('자막 확장자와 파일 형식이 일치해야 합니다.',415);
  if(Number(req.headers['content-length'])>DELIVERY_SUBTITLE_LIMIT)throw fail('자막은 256KiB 이하여야 합니다.',413);
  const label=header(req,'x-version-label',120,'최종 자막'),chunks=[];let size=0;
  for await(const chunk of req.iterator({destroyOnReturn:false})){size+=chunk.length;if(size>DELIVERY_SUBTITLE_LIMIT){req.resume();throw fail('자막은 256KiB 이하여야 합니다.',413);}chunks.push(chunk);}
  const bytes=Buffer.concat(chunks);let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw fail('자막을 UTF-8로 저장한 뒤 다시 올려 주세요.',422);}
  const report=inspect(text,{fileName});if(report.format!==extension)throw fail('자막 본문과 파일 확장자가 일치해야 합니다.',415);if(!report.cues.length||report.errors)throw fail('자막의 시간과 내용을 확인해 주세요. '+(report.issues.find(issue=>issue.severity==='error')?.message||'유효한 자막이 없습니다.'),422);
  const id=randomUUID(),temporary=located(directory,id+'.upload');await mkdir(resolve(directory,'studio-media'),{recursive:true,mode:0o700});
  try{await writeFile(temporary,bytes,{flag:'wx',mode:0o600});}catch(error){await unlink(temporary).catch(()=>{});throw error;}
  return {temporary,label,metadata:{id,diskName:id+'.'+extension,mimeType,fileName,byteSize:size}};
}
export async function commitDeliveryMedia(upload,directory){if(!subtitleTypes[upload.metadata.mimeType])return commitStudioMedia(upload,directory);await rename(upload.temporary,located(directory,upload.metadata.diskName));upload.committed=true;return upload.metadata;}
export async function discardDeliveryMedia(upload,directory){if(!upload)return;if(!subtitleTypes[upload.metadata.mimeType])return discardStudioMedia(upload,directory);await unlink(located(directory,upload.committed?upload.metadata.diskName:upload.metadata.id+'.upload')).catch(error=>{if(error.code!=='ENOENT')throw error;});}
export async function serveDeliveryMedia(req,res,directory,media,authorize=()=>{}){
  const extension=subtitleTypes[media.mimeType];if(!extension)return serveStudioMedia(req,res,directory,media,authorize);
  const path=located(directory,media.diskName);if(!media.diskName.endsWith('.'+extension))throw fail('자막 파일 형식을 확인해 주세요.',404);
  let info,bytes;try{info=await lstat(path);if(!info.isFile()||info.isSymbolicLink()||info.size>DELIVERY_SUBTITLE_LIMIT)throw fail('자막 파일을 찾을 수 없습니다.',404);bytes=await readFile(path);}catch(error){if(error.status)throw error;throw fail('자막 파일을 찾을 수 없습니다.',404);}
  if(bytes.length!==media.byteSize)throw fail('저장된 자막 파일 크기가 달라 확인이 필요합니다.',409);authorize();
  let range;try{range=mediaRange(req.headers.range,bytes.length);}catch(error){if(error.status!==416)throw error;res.writeHead(416,{'Content-Range':`bytes */${bytes.length}`,'Cache-Control':'private, no-store'});res.end();return;}
  const headers={'Content-Type':media.mimeType+'; charset=utf-8','Content-Length':range?range.end-range.start+1:bytes.length,'Accept-Ranges':'bytes','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cross-Origin-Resource-Policy':'same-origin','Content-Disposition':`attachment; filename="subtitle.${extension}"; filename*=UTF-8''${encodeURIComponent(media.fileName).replace(/'/g,'%27')}`,'Content-Security-Policy':"default-src 'none'; sandbox"};
  if(range)headers['Content-Range']=`bytes ${range.start}-${range.end}/${bytes.length}`;
  res.writeHead(range?206:200,headers);res.end(req.method==='HEAD'?undefined:range?bytes.subarray(range.start,range.end+1):bytes);
}
