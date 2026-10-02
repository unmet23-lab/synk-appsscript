import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { brotliCompress, gzip, constants } from 'node:zlib';

const compressBrotli=promisify(brotliCompress),compressGzip=promisify(gzip);
const compressible=type=>/^(?:text\/|application\/(?:javascript|json|manifest\+json)|image\/svg\+xml|font\/ttf)/i.test(type);
function qualities(header){
  const result=new Map();
  for(const part of String(header||'').split(',')){
    const [raw,...parameters]=part.trim().toLowerCase().split(';'),name=raw.trim();if(!name)continue;
    const parameter=parameters.map(value=>value.trim()).find(value=>value.startsWith('q='));
    const quality=parameter===undefined?1:Number(parameter.slice(2));
    result.set(name,Number.isFinite(quality)&&quality>=0&&quality<=1?quality:0);
  }
  return result;
}
function preferredEncoding(header,canCompress){
  const values=qualities(header),wildcard=values.get('*')??0;
  const candidates=canCompress?['br','gzip'].map(name=>({name,q:values.get(name)??wildcard})).filter(row=>row.q>0):[];
  candidates.sort((a,b)=>b.q-a.q);
  if(candidates.length){if(values.has('identity')&&values.get('identity')>candidates[0].q)return'identity';return candidates[0].name;}
    const identity=values.get('identity')??(values.get('*')===0?0:1);
  return identity>0?'identity':null;
}
const notModified=(header,etag)=>String(header||'').split(',').some(value=>value.trim()==='*'||value.trim().replace(/^W\//,'')===etag);

// Only the server's allowlisted public assets use this responder. APIs, HTML,
// session responses, and protected attachments never receive cache permission.
export function createStaticResponder({read=readFile,inspect=stat,maxBytes=16*1024*1024,maxEntries=64}={}){
  const cache=new Map(),pending=new Map();let cacheBytes=0,reads=0;
  function forget(path){const previous=cache.get(path);if(previous){cacheBytes-=previous.bytes;cache.delete(path);}}
  function trim(){while(cache.size>maxEntries||cacheBytes>maxBytes)forget(cache.keys().next().value);}
  async function load(path){
    let details;try{details=await inspect(path,{bigint:true});}catch(error){forget(path);throw error;}
    const signature=[details.size,details.mtimeNs??details.mtimeMs,details.ctimeNs??details.ctimeMs].join(':');
    const existing=cache.get(path);if(existing?.signature===signature){cache.delete(path);cache.set(path,existing);return existing;}
    forget(path);const key=path+'\n'+signature;
    if(pending.has(key))return pending.get(key);
    const loading=(async()=>{
      reads++;const raw=await read(path),digest=createHash('sha256').update(raw).digest('base64url');
      const entry={signature,raw,digest,representations:new Map(),bytes:raw.length};
      if(raw.length<=maxBytes){forget(path);cache.set(path,entry);cacheBytes+=entry.bytes;trim();}
      return entry;
    })();
    pending.set(key,loading);try{return await loading;}finally{pending.delete(key);}
  }
  async function representation(path,entry,encoding){
    if(encoding==='identity')return entry.raw;
    if(!entry.representations.has(encoding)){
      const operation=encoding==='br'?compressBrotli(entry.raw,{params:{[constants.BROTLI_PARAM_QUALITY]:4}}):compressGzip(entry.raw,{level:5});
      entry.representations.set(encoding,operation);
      operation.then(buffer=>{
        entry.bytes+=buffer.length;
        if(cache.get(path)===entry){cacheBytes+=buffer.length;trim();}
      },()=>entry.representations.delete(encoding));
    }
    return entry.representations.get(encoding);
  }
  async function respond(req,res,{path,type,headers={}}){
    const entry=await load(path),html=type.startsWith('text/html'),canCompress=entry.raw.length>=512&&compressible(type);
    const encoding=preferredEncoding(req.headers['accept-encoding'],canCompress);
    if(!encoding){res.writeHead(406,{...headers,'Cache-Control':'no-store','Vary':'Accept-Encoding','Content-Length':'0'});res.end();return;}
    const etag='"'+entry.digest+'.'+encoding+'"';
    const responseHeaders={...headers,'Content-Type':type,'Cache-Control':html?'no-store':'public, max-age=0, must-revalidate',...(compressible(type)?{'Vary':'Accept-Encoding'}:{}),...(!html?{'ETag':etag}:{}),...(encoding==='identity'?{}:{'Content-Encoding':encoding})};
    if(!html&&notModified(req.headers['if-none-match'],etag)){res.writeHead(304,responseHeaders);res.end();return;}
    const content=await representation(path,entry,encoding);
    res.writeHead(200,{...responseHeaders,'Content-Length':String(content.length)});res.end(req.method==='HEAD'?undefined:content);
  }
  respond.stats=()=>({entries:cache.size,bytes:cacheBytes,reads,pending:pending.size});
  return respond;
}
