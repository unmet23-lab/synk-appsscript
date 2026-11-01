import {gzip} from 'node:zlib';
import {promisify} from 'node:util';

const gzipAsync=promisify(gzip);
export function acceptsGzip(header){
  if(typeof header!=='string')return false;
  const qualities=new Map();
  for(const item of header.toLowerCase().split(',')){
    const [name,...parameters]=item.trim().split(';').map(value=>value.trim());
    if(name!=='gzip'&&name!=='*')continue;
    let quality=1;
    if(parameters.length){const match=parameters.length===1&&/^q=(0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.exec(parameters[0]);quality=match?Number(match[1]):0;}
    qualities.set(name,Math.min(qualities.get(name)??1,quality));
  }
  return (qualities.get('gzip')??qualities.get('*')??0)>0;
}

// A bounded worker-pool operation, with no cross-request data cache. Small
// replies and a busy/failed compressor retain the existing identity encoding.
export function createJsonCompressor({compress=gzipAsync,maxConcurrent=2}={}){
  let active=0;
  return async function encode(value,acceptEncoding){
    const body=Buffer.from(JSON.stringify(value)),plain={body,encoding:null};
    if(body.length<1024||!acceptsGzip(acceptEncoding)||active>=maxConcurrent)return plain;
    active++;
    try{const compressed=await compress(body,{level:1});return compressed.length<body.length?{body:compressed,encoding:'gzip'}:plain;}
    catch{return plain;}
    finally{active--;}
  };
}
