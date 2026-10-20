import { open } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';

// A single byte range covers media probes and seeks. Unsupported or malformed
// ranges are ignored; valid ranges outside the representation return 416.
// RFC 9110 sections 13.1.5, 14.1.2 and 14.2.
function byteRange(header,size){
  const match=/^bytes=(\d*)-(\d*)$/i.exec(String(header||'').trim());
  if(!match||(!match[1]&&!match[2]))return null;
  const length=BigInt(size);
  if(!length)return false;
  if(!match[1]){
    const suffix=BigInt(match[2]);
    return suffix?{start:Number(suffix>=length?0n:length-suffix),end:size-1}:false;
  }
  const start=BigInt(match[1]),end=match[2]?BigInt(match[2]):length-1n;
  if(start>=length||end<start)return false;
  return{start:Number(start),end:Number(end>=length?length-1n:end)};
}

export async function respondStaticMedia(req,res,{path,type,headers={}}){
  const file=await open(path,'r');
  try{
    const details=await file.stat({bigint:true});
    if(!details.isFile()||details.size>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('Unsupported static media file');
    const size=Number(details.size);
    // Metadata avoids hashing or buffering a whole movie for a two-byte probe.
    // It is deliberately weak and cannot validate If-Range (strong comparison).
    const etag='W/"'+[details.dev,details.ino,details.size,details.mtimeNs,details.ctimeNs].join('-')+'"';
    const responseHeaders={...headers,'Content-Type':type,'Cache-Control':'public, max-age=0, must-revalidate','Accept-Ranges':'bytes','ETag':etag};
    if(String(req.headers['if-none-match']||'').split(',').some(value=>value.trim()==='*'||value.trim().replace(/^W\//,'')===etag.slice(2))){
      res.writeHead(304,responseHeaders);res.end();return;
    }
    const range=req.method==='GET'&&!req.headers['if-range']?byteRange(req.headers.range,size):null;
    if(range===false){res.writeHead(416,{...responseHeaders,'Content-Range':'bytes */'+size,'Content-Length':'0'});res.end();return;}
    const length=range?range.end-range.start+1:size;
    res.writeHead(range?206:200,{...responseHeaders,'Content-Length':String(length),...(range?{'Content-Range':`bytes ${range.start}-${range.end}/${size}`}:{})});
    if(req.method==='HEAD'||!length){res.end();return;}
    try{await pipeline(file.createReadStream(range||{}),res);}
    catch(error){if(!res.destroyed)throw error;}
  }finally{await file.close();}
}
