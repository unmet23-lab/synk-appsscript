import { sharedAccountServer } from '../synk-account/server-shared.mjs';
import http from 'node:http';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {BOOK_CSS} from './takehome.mjs';
const ROOT=fileURLToPath(new URL('.',import.meta.url));
const PUBLIC=new Map(['index.html','style.css','app.mjs','model.mjs','storage.mjs','media.mjs','operations.mjs','assets/camera.webp','assets/wide-butter.webp','assets/SUIT.woff2','assets/InterTight.woff2','assets/synk-logo.svg','assets/slab-coral-long.webp','assets/slab-cream-long.webp','assets/slab-blush-long.webp'].map(file=>['/'+file,new URL(file,import.meta.url)]));
PUBLIC.set('/core/ask.js',new URL('../../atlas/ask.js',import.meta.url));PUBLIC.set('/core/domain.js',new URL('../../atlas/domain.js',import.meta.url));
PUBLIC.set('/takehome.mjs',new URL('./takehome.mjs',import.meta.url));
PUBLIC.set('/form-drafts.mjs',new URL('./form-drafts.mjs',import.meta.url));
PUBLIC.set('/account-media.mjs',new URL('./account-media.mjs',import.meta.url));
PUBLIC.set('/member-book-assets.mjs',new URL('../member-book-assets.mjs',import.meta.url));
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.webp':'image/webp','.woff2':'font/woff2','.svg':'image/svg+xml'};
const HEADERS={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self' data: blob:; font-src 'self'; connect-src 'none'; object-src 'none'; frame-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",'Permissions-Policy':'camera=(), microphone=(self), geolocation=()'};
export function createServer({port=4298,accountConfigPath,accountConfig}={}){
 const shared=sharedAccountServer({configPath:accountConfigPath,config:accountConfig});
 const server=http.createServer(async(req,res)=>{
  await shared.ready;
  const headers={...HEADERS,'Content-Security-Policy':HEADERS['Content-Security-Policy'].replace("connect-src 'none'",`connect-src ${shared.connections()}`)};
  const send=(status,body,type='application/json; charset=utf-8')=>{res.writeHead(status,{...headers,'Content-Type':type});res.end(req.method==='HEAD'?undefined:typeof body==='string'||Buffer.isBuffer(body)?body:JSON.stringify(body));};
  const host=req.headers.host||'',origin=`http://${host}`;
  if(!/^(127\.0\.0\.1|localhost):\d+$/.test(host)||Number(host.split(':')[1])!==server.address()?.port)return send(403,{error:'이 PC의 앨범 주소에서 열어 주세요.'});
  if(req.headers.origin&&req.headers.origin!==origin)return send(403,{error:'이 앱에서 직접 열어 주세요.'});
  let requestUrl;try{requestUrl=new URL(req.url,origin);}catch{return send(400,{error:'올바르지 않은 주소예요.'});}
  if(req.headers['sec-fetch-site']==='cross-site'&&!shared.allowsOAuthReturn(req,requestUrl,'family-album'))return send(403,{error:'이 앱에서 직접 열어 주세요.'});
  if(!['GET','HEAD'].includes(req.method))return send(405,{error:'지원하지 않는 요청이에요.'});
  let pathname;try{pathname=decodeURIComponent(requestUrl.pathname);}catch{return send(400,{error:'올바르지 않은 주소예요.'});}
  const common=await shared.read(pathname);if(common)return send(200,common.body,common.type);
  if(pathname==='/api/health')return send(200,{ok:true,product:'family-album',mode:'local-mvp',data:'browser-only',cloudAI:false,accountSync:false});
  if(pathname==='/takehome.css')return send(200,BOOK_CSS,'text/css; charset=utf-8');
  const file=PUBLIC.get(pathname==='/'?'/index.html':pathname);if(!file)return send(404,{error:'찾을 수 없는 파일이에요.'});
  try{return send(200,await readFile(file),MIME[path.extname(file.pathname)]);}catch{return send(404,{error:'찾을 수 없는 파일이에요.'});}
 });
 server.start=()=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',()=>{server.removeListener('error',reject);resolve(server);});});
 server.stop=async()=>{server.closeAllConnections();if(server.listening)await new Promise(resolve=>server.close(resolve));};return server;
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.join(ROOT,'server.mjs')){const i=process.argv.indexOf('--port'),port=i<0?4298:Number(process.argv[i+1]);if(!Number.isInteger(port)||port<0||port>65535)throw new Error('Invalid port');const server=createServer({port});await server.start();console.log(`SYNK 가족 이야기 앨범: http://127.0.0.1:${server.address().port}`);for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await server.stop();process.exit(0);});}
