import { sharedAccountServer } from '../synk-account/server-shared.mjs';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const ROOT=fileURLToPath(new URL('.',import.meta.url));
const PUBLIC=['index.html','style.css','app.mjs','model.mjs','scene.mjs','xr.mjs','vendor/three.module.js','vendor/three.core.js','vendor/engine.js','vendor/trail.js','vendor/personalization.js',...['SUIT.woff2','InterTight.woff2','DMMono.woff2','logo-path.webp','slab-cream-long.webp','slab-blush-long.webp','slab-coral-long.webp','badge-check.webp','wide-cream.webp','wide-lapis.webp','wide-butter.webp'].map(n=>'assets/'+n)];
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.webp':'image/webp','.woff2':'font/woff2'};
export function createServer({port=4292,accountConfigPath,accountConfig}={}){
  const shared=sharedAccountServer({configPath:accountConfigPath,config:accountConfig});
  const server=http.createServer(async(req,res)=>{
    await shared.ready;
    const headers={'X-Content-Type-Options':'nosniff','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'",'Permissions-Policy':'xr-spatial-tracking=(self)'};
    headers['Content-Security-Policy']=headers['Content-Security-Policy'].replace("connect-src 'self'",`connect-src ${shared.connections()}`);
    const send=(status,body,type='text/plain; charset=utf-8')=>{res.writeHead(status,{...headers,'Content-Type':type});res.end(req.method==='HEAD'?undefined:body);};
    if(!['GET','HEAD'].includes(req.method))return send(405,'Method not allowed');
    const host=(req.headers.host||'').split(':')[0];if(!['127.0.0.1','localhost'].includes(host))return send(403,'Local host only');
    let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);}catch{return send(400,'Bad URL');}
    const common=await shared.read(pathname);if(common)return send(200,common.body,common.type);
    if(pathname==='/api/health')return send(200,JSON.stringify({ok:true,product:'path',mode:'local-mvp',data:'browser-only'}),'application/json');
    const file=pathname==='/'?'index.html':pathname.slice(1);if(!PUBLIC.includes(file))return send(404,'Not found');
    try{return send(200,await readFile(path.join(ROOT,file)),MIME[path.extname(file)]);}catch{return send(404,'Not found');}
  });
  server.start=()=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',()=>{server.removeListener('error',reject);resolve(server);});});return server;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const i=process.argv.indexOf('--port'),port=i<0?4292:Number(process.argv[i+1]);
  if(!Number.isInteger(port)||port<0||port>65535)throw Error('Invalid port');
  const server=createServer({port});await server.start();console.log(`SYNK PATH: http://127.0.0.1:${server.address().port}`);
}
