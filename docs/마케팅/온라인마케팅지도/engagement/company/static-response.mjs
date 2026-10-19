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
const scriptOrStyle=type=>/^(?:text\/(?:javascript|css)|application\/javascript)(?:;|$)/i.test(type);
function exactVersion(url,digest){
  try{const query=new URL(url,'http://static.invalid').searchParams;return query.size===1&&query.getAll('v').length===1&&query.get('v')===digest;}catch{return false;}
}
function assetReferences(content,documentPath){
  const source=content.toString('utf8'),base=new URL(documentPath,'http://static.invalid'),references=[];
  for(const match of source.matchAll(/((?:src|href)=["'])([^"']+)(["'])/g)){
    let url;try{url=new URL(match[2],base);}catch{continue;}
    if(url.origin!==base.origin||url.search||url.hash||! /\.(?:js|css)$/.test(url.pathname))continue;
    references.push({start:match.index,end:match.index+match[0].length,prefix:match[1],value:match[2],suffix:match[3],path:url.pathname});
  }
  return references;
}
export const publicScriptAndStylePaths=(content,documentPath)=>new Set(assetReferences(content,documentPath).map(row=>row.path));

// Only the server's allowlisted public assets use this responder. APIs, HTML,
// session responses, and protected attachments never receive cache permission.
export function createStaticResponder({read=readFile,inspect=stat,maxBytes=16*1024*1024,maxEntries=64,maxDigestEntries=256}={}){
  const cache=new Map(),pending=new Map(),digests=new Map(),digestPending=new Map();let cacheBytes=0,reads=0;
  const signatureOf=details=>[details.size,details.mtimeNs??details.mtimeMs,details.ctimeNs??details.ctimeMs].join(':');
  function rememberDigest(path,signature,digest){digests.delete(path);digests.set(path,{signature,digest});while(digests.size>maxDigestEntries)digests.delete(digests.keys().next().value);}
  async function digest(path){
    let details;try{details=await inspect(path,{bigint:true});}catch(error){digests.delete(path);throw error;}
    const signature=signatureOf(details),known=digests.get(path);
    if(known?.signature===signature){rememberDigest(path,signature,known.digest);return known.digest;}
    const body=cache.get(path);if(body?.signature===signature){rememberDigest(path,signature,body.digest);return body.digest;}
    const key=path+'\n'+signature;if(digestPending.has(key))return digestPending.get(key);
    const operation=(async()=>{const bytes=await read(path),value=createHash('sha256').update(bytes).digest('base64url');if(signature===signatureOf(await inspect(path,{bigint:true})))rememberDigest(path,signature,value);return value;})();
    digestPending.set(key,operation);try{return await operation;}finally{digestPending.delete(key);}
  }
  function forget(path){const previous=cache.get(path);if(previous){cacheBytes-=previous.bytes;cache.delete(path);}}
  function trim(){while(cache.size>maxEntries||cacheBytes>maxBytes)forget(cache.keys().next().value);}
  async function load(path){
    let details;try{details=await inspect(path,{bigint:true});}catch(error){forget(path);digests.delete(path);throw error;}
    const signature=signatureOf(details);
    const existing=cache.get(path);if(existing?.signature===signature){cache.delete(path);cache.set(path,existing);return existing;}
    forget(path);const key=path+'\n'+signature;
    if(pending.has(key))return pending.get(key);
    const loading=(async()=>{
      reads++;const raw=await read(path),digest=createHash('sha256').update(raw).digest('base64url');
      const entry={signature,raw,digest,representations:new Map(),bytes:raw.length};
      rememberDigest(path,signature,digest);
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
  async function respond(req,res,{path,type,headers={},versioned=false,transformHTML=null}){
    const html=type.startsWith('text/html');let entry=await load(path);
    // HTML dependencies are checked on every request; the file's mtime alone is insufficient.
    if(transformHTML){if(!html)throw new TypeError('Only HTML may use a document transform');const raw=Buffer.from(await transformHTML(entry.raw));entry={raw,digest:createHash('sha256').update(raw).digest('base64url'),representations:new Map(),bytes:raw.length};}
    const canCompress=entry.raw.length>=512&&compressible(type);
    const encoding=preferredEncoding(req.headers['accept-encoding'],canCompress);
    if(!encoding){res.writeHead(406,{...headers,'Cache-Control':'no-store','Vary':'Accept-Encoding','Content-Length':'0'});res.end();return;}
    const etag='"'+entry.digest+'.'+encoding+'"';
    // Match the exact entry whose bytes are sent, never a separate preliminary lookup.
    const immutable=versioned&&scriptOrStyle(type)&&exactVersion(req.url,entry.digest);
    const responseHeaders={...headers,'Content-Type':type,'Cache-Control':html?'no-store':immutable?'public, max-age=31536000, immutable':'public, max-age=0, must-revalidate',...(compressible(type)?{'Vary':'Accept-Encoding'}:{}),...(!html?{'ETag':etag}:{}),...(encoding==='identity'?{}:{'Content-Encoding':encoding})};
    if(!html&&notModified(req.headers['if-none-match'],etag)){res.writeHead(304,responseHeaders);res.end();return;}
    const content=await representation(path,entry,encoding);
    res.writeHead(200,{...responseHeaders,'Content-Length':String(content.length)});res.end(req.method==='HEAD'?undefined:content);
  }
  respond.version=digest;
  respond.versionHTML=async(content,{documentPath,resolveAsset})=>{
    let source=content.toString('utf8');const replacements=[];
    for(const ref of assetReferences(source,documentPath)){const path=resolveAsset(ref.path);if(path)replacements.push({...ref,digest:await digest(path)});}
    for(const ref of replacements.reverse())source=source.slice(0,ref.start)+ref.prefix+ref.value+'?v='+ref.digest+ref.suffix+source.slice(ref.end);
    return Buffer.from(source);
  };
  respond.stats=()=>({entries:cache.size,bytes:cacheBytes,reads,pending:pending.size,digestEntries:digests.size,digestPending:digestPending.size});
  return respond;
}
