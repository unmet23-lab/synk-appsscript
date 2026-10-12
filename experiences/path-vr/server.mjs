import { sharedAccountServer } from '../synk-account/server-shared.mjs';
import http from 'node:http';
import https from 'node:https';
import {readFile,stat,readdir,realpath} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const ROOT=fileURLToPath(new URL('.',import.meta.url));
const PUBLIC=['index.html','style.css','app.mjs','model.mjs','scene.mjs','xr.mjs','vendor/three.module.js','vendor/three.core.js','vendor/engine.js','vendor/trail.js','vendor/personalization.js',...['SUIT.woff2','InterTight.woff2','DMMono.woff2','logo-path.webp','slab-cream-long.webp','slab-blush-long.webp','slab-coral-long.webp','badge-check.webp','wide-cream.webp','wide-lapis.webp','wide-butter.webp'].map(n=>'assets/'+n)];
const INTERVIEW_PUBLIC=['index.html','style.css','room.mjs','app.mjs','dialogue.mjs','content.mjs','actors.mjs','audio.mjs','voice.mjs','audio-worklet.js','credits.json','film-manifest.json','film-player.mjs','film/index.html','film/style.css','film/preview.mjs','film/compare.html','film/compare.css','film/compare.mjs','film/nanobanana.html','film/rehearsal.html','film/rehearsal.css','film/rehearsal.mjs','film/rehearsal-session.mjs','film/answer-followup.mjs','film/listening-sequence.mjs','film/strict-vr.mjs','film/room-space.mjs','film/speech-turn.mjs','film/strict-manifest.json'].map(n=>'interview/'+n);
// Explicit model assets only: a benchmark file placed beside a model must never
// become public merely because its extension matches a runtime asset.
export const WHISPER_PUBLIC_FILES=Object.freeze([
  'interview/whisper-model.mjs','interview/whisper-worker.mjs','interview/film/voice-assessment.mjs',
  ...['transformers.min.js','ort-wasm-simd-threaded.jsep.mjs','ort-wasm-simd-threaded.jsep.wasm','LICENSE-TRANSFORMERS.txt','LICENSE-ONNXRUNTIME.txt','README.md','PROVENANCE.json'].map(n=>'vendor/transformers/'+n),
  ...['config.json','generation_config.json','preprocessor_config.json','tokenizer.json','tokenizer_config.json','revision.txt','onnx/encoder_model_quantized.onnx','onnx/decoder_model_merged_quantized.onnx','LICENSE-WHISPER.txt','UPSTREAM-MODEL-CARD.txt','README.md','PROVENANCE.json'].map(n=>'models/whisper-base/'+n),
]);
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.webp':'image/webp','.woff2':'font/woff2','.glb':'model/gltf-binary','.json':'application/json; charset=utf-8','.mp3':'audio/mpeg','.mp4':'video/mp4','.webm':'video/webm','.wav':'audio/wav','.gz':'application/gzip','.wasm':'application/wasm','.onnx':'application/octet-stream','.png':'image/png','.jpg':'image/jpeg','.txt':'text/plain; charset=utf-8','.md':'text/plain; charset=utf-8'};
export async function publicFiles(){
  const list=[...PUBLIC,...INTERVIEW_PUBLIC,...WHISPER_PUBLIC_FILES,'assets/licenses/SUIT-OFL.txt','assets/licenses/InterTight-OFL.txt','assets/licenses/DMMono-OFL.txt','vendor/GLTFLoader.js','vendor/BufferGeometryUtils.js','vendor/HDRLoader.js','vendor/THREE-LICENSE.txt','vendor/vosk/vosk.mjs','vendor/vosk/vosk-worker.js','vendor/vosk/LICENSE.txt','vendor/vosk/NOTICE.txt','models/vosk-model-small-ko-0.22.tar.gz'];
  for(const directory of ['assets/interview/actors','assets/interview/audio','assets/interview/room'])try{for(const f of await readdir(path.join(ROOT,directory),{withFileTypes:true}))if(f.isFile()&&!f.name.startsWith('.')&&/\.(glb|mp3|json|txt|jpg|hdr)$/.test(f.name))list.push(directory+'/'+f.name);}catch{}
  list.push('assets/interview/film/room-reference.png','assets/interview/film/room-reference-nanobanana.jpg','assets/interview/film/room-reference-4k.jpg','assets/interview/film/room-poster-4k.jpg','assets/interview/room/back-wall-photo.png','assets/interview/room/back-wall-elevation.png','assets/interview/room/front-room-extension.png','assets/interview/room/front-room-wide.png','assets/interview/room/left-wall-photo.png','assets/interview/room/right-wall-photo.png');
  try{for(const f of await readdir(path.join(ROOT,'assets/interview/film'),{withFileTypes:true}))if(f.isFile()&&/^[a-z0-9-]+\.(mp4|webm)$/.test(f.name))list.push('assets/interview/film/'+f.name);}catch{}
  return list;
}
export function parseRange(header,size){if(!header)return null;const m=/^bytes=(\d*)-(\d*)$/.exec(header);if(!m||(!m[1]&&!m[2]))return false;let start,end;if(!m[1]){const suffix=Number(m[2]);if(!Number.isSafeInteger(suffix)||suffix<=0)return false;start=Math.max(0,size-suffix);end=size-1;}else{start=Number(m[1]);end=m[2]?Number(m[2]):size-1;}if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=size||start>end)return false;return {start,end:Math.min(end,size-1)};}
export function createServer({port=4292,accountConfigPath,accountConfig,host='127.0.0.1',tls,allowedHosts=[]}={}){
  if(host!=='127.0.0.1'&&(!tls?.key||!tls?.cert||!allowedHosts.length))throw Error('LAN serving requires TLS and explicit allowedHosts');
  const shared=sharedAccountServer({configPath:accountConfigPath,config:accountConfig});
  const approvedPromise=publicFiles().then(files=>new Set(files));
  const handler=async(req,res)=>{
    await shared.ready;
    const headers={'X-Content-Type-Options':'nosniff','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'",'Permissions-Policy':'xr-spatial-tracking=(self), microphone=(self)'};
    headers['Content-Security-Policy']=headers['Content-Security-Policy'].replace("connect-src 'self'",`connect-src ${shared.connections()} blob:`);
    const send=(status,body,type='text/plain; charset=utf-8')=>{res.writeHead(status,{...headers,'Content-Type':type});res.end(req.method==='HEAD'?undefined:body);};
    if(!['GET','HEAD'].includes(req.method))return send(405,'Method not allowed');
    const requestHost=(req.headers.host||'').split(':')[0];if(!['127.0.0.1','localhost',...allowedHosts].includes(requestHost))return send(403,'Local host only');
    let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);}catch{return send(400,'Bad URL');}
    const common=await shared.read(pathname);if(common)return send(200,common.body,common.type);
    if(pathname==='/api/health')return send(200,JSON.stringify({ok:true,product:'path',mode:'local-mvp',data:'browser-only'}),'application/json');
    const file=pathname==='/'?'index.html':pathname==='/interview/'?'interview/index.html':pathname==='/interview/film/'?'interview/film/index.html':pathname.slice(1);if(!(await approvedPromise).has(file))return send(404,'Not found');
    if(file==='vendor/vosk/vosk-worker.js')headers['Content-Security-Policy']=headers['Content-Security-Policy'].replace("script-src 'self' 'wasm-unsafe-eval'","script-src 'self' 'unsafe-eval'");
    try{const absolute=await realpath(path.join(ROOT,file));if(!absolute.startsWith(ROOT))return send(404,'Not found');const info=await stat(absolute),range=parseRange(req.headers.range,info.size);if(range===false){res.writeHead(416,{...headers,'Content-Range':`bytes */${info.size}`});return res.end();}const start=range?.start||0,end=range?.end??info.size-1;res.writeHead(range?206:200,{...headers,'Content-Type':MIME[path.extname(file)]||'application/octet-stream','Accept-Ranges':'bytes','Content-Length':Math.max(0,end-start+1),...(range?{'Content-Range':`bytes ${start}-${end}/${info.size}`}:{})});if(req.method==='HEAD')return res.end();const stream=createReadStream(absolute,range?{start,end}:{});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);}catch{return send(404,'Not found');}
  };
  const server=tls?https.createServer(tls,handler):http.createServer(handler);
  server.start=()=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,()=>{server.removeListener('error',reject);resolve(server);});});return server;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const i=process.argv.indexOf('--port'),port=i<0?4292:Number(process.argv[i+1]);
  if(!Number.isInteger(port)||port<0||port>65535)throw Error('Invalid port');
  const arg=name=>{const i=process.argv.indexOf(name);return i<0?undefined:process.argv[i+1];};const host=arg('--host')||'127.0.0.1',key=arg('--tls-key'),cert=arg('--tls-cert'),allowedHosts=(arg('--allowed-hosts')||'').split(',').filter(Boolean);const tls=key&&cert?{key:await readFile(key),cert:await readFile(cert)}:undefined;
  const server=createServer({port,host,tls,allowedHosts});await server.start();console.log(`SYNK PATH: ${tls?'https':'http'}://${host}:${server.address().port}/interview/film/rehearsal.html`);
}
