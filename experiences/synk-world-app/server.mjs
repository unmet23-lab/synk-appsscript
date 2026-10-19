import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {randomBytes,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createAccountTownHost} from './town-host.mjs';
import {publicWorldConfig} from './operating-mode.mjs';
import {renderWorldDocument} from './document.mjs';
const require=createRequire(import.meta.url);
const root=fileURLToPath(new URL('./',import.meta.url));
const home=path.resolve(root,'../synk-world-home');
const town=path.resolve(root,'../synk-town');
const brandOpening=path.resolve(root,'../brand-opening');
// 형제 저장소. Claude 앱 워크트리(.claude/worktrees/<이름>)처럼 깊은 사본에서는 SYNK_TALK_ROOT로 가리킨다(tools/sync-atlas.js와 같은 이름).
const talk=process.env.SYNK_TALK_ROOT?path.resolve(process.env.SYNK_TALK_ROOT):path.resolve(root,'../../../SYNK-talk');
const port=Number(process.env.SYNK_WORLD_PORT||4296);
const {createWorldV1Service}=require(path.join(talk,'lib/world-v1-server.js'));
const {createWorldV1Store}=require(path.join(talk,'lib/world-v1-store.js'));
const {createWorldV1LocalDb}=require(path.join(talk,'tools/world-v1-local-db.js'));
const mode=process.env.SYNK_WORLD_MODE||'rehearsal';
if(!['rehearsal','account'].includes(mode))throw Error('SYNK_WORLD_MODE must be rehearsal or account');
const publicConfig=publicWorldConfig(mode==='account'?{mode,basePath:process.env.SYNK_WORLD_BASE_PATH||'/',account:JSON.parse(fs.readFileSync(process.env.SYNK_WORLD_ACCOUNT_CONFIG,'utf8'))}:{mode,basePath:'/'},`http://127.0.0.1:${port}/`);
if(mode==='rehearsal')fs.mkdirSync(path.join(root,'.local'),{recursive:true});
const dataDir=process.env.SYNK_WORLD_DATA_DIR||path.join(root,'.local/db-v1');
const database=mode==='rehearsal'?await createWorldV1LocalDb({dataDir}):null;
const playRuntime=mode==='rehearsal'?require(path.join(talk,'supabase/functions/_shared/synk-play-runtime.js')):null;
if(database)await database.db.exec(fs.readFileSync(path.join(talk,'supabase/migrations/20261009170000_synk_play_c16.sql'),'utf8'));
const townHost=mode==='rehearsal'?createAccountTownHost({directory:`${dataDir}-town`}):null;
const sessions=new Map();
const ids={'player-a':'11111111-1111-4111-8111-111111111111','player-b':'22222222-2222-4222-8222-222222222222'};
const allowedGames=new Set(['korean-runner','korean-rhythm','hangul-stage']);
const mime={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2','.ttf':'font/ttf','.mp4':'video/mp4','.mp3':'audio/mpeg','.wav':'audio/wav','.glb':'model/gltf-binary','.wasm':'application/wasm'};
function sessionCookieName(request){const tab=request.headers.get('x-synk-rehearsal-tab');return tab?`synk_world_rehearsal_${tab.toLowerCase()}`:'synk_world_rehearsal';}
function cookieToken(request){const name=sessionCookieName(request);return request.headers.get('cookie')?.match(new RegExp(`(?:^|;\\s*)${name}=([A-Za-z0-9_-]+)(?:;|$)`))?.[1];}
function requestToken(request){return request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_-]+)$/)?.[1]||cookieToken(request);}
function identity(request){const token=requestToken(request);const entry=sessions.get(token);if(!entry||entry.expires<Date.now()){sessions.delete(token);throw Object.assign(Error('AUTH_REQUIRED'),{status:401,code:'AUTH_REQUIRED'});}return entry.identity;}
const service=database?createWorldV1Service({store:createWorldV1Store(database.sql),verify:async request=>identity(request),enabled:()=>true}):null;
const lifeService=database?playRuntime.createPlayService({store:playRuntime.createPlayStore(database.sql,{model:playRuntime.model,economy:playRuntime.economy}),verify:async request=>identity(request),model:playRuntime.model,economy:playRuntime.economy,enabled:()=>true}):null;
const json=(res,status,data,headers={})=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(data));};
async function body(req,limit=16384){let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>limit)throw Object.assign(Error('PAYLOAD_TOO_LARGE'),{status:413});chunks.push(chunk);}return Buffer.concat(chunks);}
const server=http.createServer(async(req,res)=>{
 try{
  const expectedHost=new Set([`127.0.0.1:${port}`,`localhost:${port}`,`10.0.2.2:${port}`]);if(!expectedHost.has(req.headers.host))return json(res,403,{ok:false,error:{code:'HOST_FORBIDDEN'}});
  const origin=req.headers.origin;if(origin&&!new Set([`http://127.0.0.1:${port}`,`http://localhost:${port}`]).has(origin))return json(res,403,{ok:false,error:{code:'ORIGIN_FORBIDDEN'}});
  const url=new URL(req.url,`http://127.0.0.1:${port}`);
  if(publicConfig.basePath!=='/'&&url.pathname.startsWith(publicConfig.basePath))url.pathname='/'+url.pathname.slice(publicConfig.basePath.length);
  if(url.pathname==='/world-config.json'){if(req.method!=='GET')return json(res,405,{error:'METHOD_NOT_ALLOWED'});return json(res,200,publicConfig);}
  if(url.pathname==='/health')return json(res,200,{ok:true,mode,rehearsal:mode==='rehearsal',database:database?'local-postgresql':null,production:false});
  if(url.pathname.startsWith('/api/world/')){
   if(mode!=='rehearsal')return json(res,404,{ok:false,error:{code:'REHEARSAL_DISABLED'}});
   const tab=req.headers['x-synk-rehearsal-tab'];if(tab!==undefined&&(typeof tab!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tab)))return json(res,400,{ok:false,error:{code:'REHEARSAL_TAB_INVALID'}});
   if(!['GET','POST','PUT'].includes(req.method))return json(res,405,{ok:false,error:{code:'METHOD_NOT_ALLOWED'}});
   if(req.method!=='GET'&&!req.headers['content-type']?.startsWith('application/json'))return json(res,415,{ok:false,error:{code:'JSON_REQUIRED'}});
   const raw=req.method==='GET'?undefined:await body(req,url.pathname==='/api/world/life-progress'?600000:16384);const headers=new Headers(req.headers);
   const suffix=url.pathname.slice('/api/world/'.length);
   const request=new Request(`http://local/synk-world-v1/${suffix}${url.search}`,{method:req.method,headers,...(raw?{body:raw}:{})});
   if(suffix==='rehearsal/status'&&req.method==='GET'){let authenticated=false;try{identity(request);authenticated=true;}catch{}return json(res,200,{ok:true,authenticated,rehearsal:true,...(authenticated?{accessToken:requestToken(request)}:{})});}
   if(suffix==='rehearsal/session'&&req.method==='POST'){
    const data=JSON.parse(raw.toString('utf8'));if(Object.keys(data).length!==1||!Object.hasOwn(ids,data.accountKey))return json(res,400,{ok:false,error:{code:'REHEARSAL_PROFILE_INVALID'}});
    // Only fixed, synthetic identities exist here. This endpoint is never part of production Auth.
    const token=randomBytes(32).toString('base64url');const id=ids[data.accountKey];const issuedAt=Math.floor(Date.now()/1000);const session={id,sessionId:randomUUID(),issuedAt,product:'world'};
    for(const [key,value]of sessions)if(value.expires<Date.now())sessions.delete(key);
    if(sessions.size>=64)return json(res,429,{ok:false,error:{code:'REHEARSAL_SESSION_LIMIT'}});
    sessions.set(token,{identity:session,expires:Date.now()+3600000});
    return json(res,200,{ok:true,accessToken:token,accountId:id,rehearsal:true},{'Set-Cookie':`${sessionCookieName(request)}=${token}; HttpOnly; SameSite=Strict; Path=/api/world; Max-Age=3600`});
   }
   if(suffix==='rehearsal/logout'&&req.method==='POST'){const token=requestToken(request),cookie=cookieToken(request);sessions.delete(token);return json(res,200,{ok:true},token===cookie?{'Set-Cookie':`${sessionCookieName(request)}=; HttpOnly; SameSite=Strict; Path=/api/world; Max-Age=0`}:{});}
   if(suffix==='life-progress'){
    if(!['GET','POST'].includes(req.method))return json(res,405,{ok:false,error:{code:'METHOD_NOT_ALLOWED'}});
    if(req.method==='POST'){let command;try{command=JSON.parse(raw.toString('utf8'));}catch{return json(res,400,{ok:false,error:{code:'INVALID_JSON'}});}if(command.action!=='progress'||!Array.isArray(command.changes)||command.changes.some(change=>change.key!=='synk.life-korean.progress.v1'))return json(res,400,{ok:false,error:{code:'INVALID_PLAY_REQUEST'}});}
    const reply=await lifeService(new Request('http://local/synk-play',{method:req.method,headers,...(raw?{body:raw}:{})}));res.writeHead(reply.status,Object.fromEntries([...reply.headers].filter(([name])=>!name.startsWith('access-control'))));res.end(await reply.text());return;
   }
   if(suffix.startsWith('town/')){
    const account=identity(request);let input;
    try{input=raw?JSON.parse(raw.toString('utf8')):undefined;}catch{return json(res,400,{error:'INVALID_JSON'});}
    const reply=townHost.handle(account.id,suffix.slice(5),req.method,input);return json(res,reply.status,reply.body);
   }
   const reply=await service(request);res.writeHead(reply.status,Object.fromEntries([...reply.headers].filter(([name])=>!name.startsWith('access-control'))));res.end(await reply.text());return;
  }
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
  let pathname=decodeURIComponent(url.pathname),base=home;
  // Reject alternate Windows separators before any prefix allowlist or path resolution.
  if(/[\\\0]/.test(pathname)||pathname.split('/').some(segment=>segment==='.'||segment==='..')){res.writeHead(403).end();return;}
  const first=pathname.split('/')[1];
  if(first==='brand-opening'){base=brandOpening;pathname=pathname.slice(first.length+1);}
  else if(allowedGames.has(first)){base=path.resolve(root,'..',first);pathname=pathname.slice(first.length+1);}
  else if(pathname.startsWith('/synk-world-home/')){pathname=pathname.slice('/synk-world-home'.length);base=home;}
  else if(pathname==='/enrollment.mjs'){base=path.resolve(root,'../synk-account/src');}
  // Preview-only route (10-14 redesign worktree): the games import ../social-conversion.mjs (shared trial tracking, in progress elsewhere).
  else if(pathname==='/social-conversion.mjs'){base=path.resolve(root,'..');}
  else if(['/world-bootstrap.js','/app-shell.mjs','/app-shell.css','/world-client.mjs','/world-town-client.mjs','/world-account.bundle.mjs','/life-ui.mjs','/life-story.mjs','/life-ui.css','/life-content.mjs','/life-progress.mjs','/world-learning-ui.mjs','/world-learning-profile.mjs','/world-learning-profile-core.mjs','/tutor-selection-sync.mjs','/cafe-activity.mjs','/cafe-ui.mjs','/classroom-lessons.mjs'].includes(pathname))base=root;
  else if(['/engine/loom-motion.js','/engine/loom-life.js'].includes(pathname)){base=path.resolve(root,'../../tools/lib');pathname='/'+path.basename(pathname);}
  else if(pathname.startsWith('/town/')){
   pathname=pathname.slice(5);base=town;
   if(pathname==='/day.html'){
    const html=fs.readFileSync(path.join(town,'day.html'),'utf8').replace('<head>',`<head><script>window.__SYNK_WORLD_TOWN__=${JSON.stringify({mode,rehearsal:mode==='rehearsal',accountScoped:true,basePath:publicConfig.basePath})};</script>`);
    res.writeHead(200,{'Content-Type':mime['.html'],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:html);return;
   }
   if(pathname.startsWith('/day-assets/')){
    const file=path.basename(pathname);
    if(['three.module.js','three.core.js'].includes(file)){res.writeHead(307,{Location:'/scene-assets/'+file}).end();return;}
    else if(file==='THREE-LICENSE.txt'){base=home;pathname='/scene-assets/'+file;}
    else if(file==='felt-coral.webp'){base=home;pathname='/assets/'+file;}
    else if(['azure-sky-v3.jpg','azure-sky-v3-mobile.jpg','terrain-normal.jpg','cliff-normal.jpg'].includes(file)){base=home;pathname='/scene-assets/graphics-v2/'+file;}
    else {res.writeHead(404).end();return;}
   // day-district.mjs, its loaders and the Basis transcoder: the baked town is WORLD's default since 10-19.
   }else if(!/^\/(?:(?:day-app\.mjs|day-style\.css|day-scene\.mjs|day-character\.mjs|day-residents\.mjs|day-environment\.mjs|day-materials\.mjs|day-rendering\.mjs|day-district\.mjs|walk\.mjs|walk-controls\.mjs|town-layout\.mjs)$|rendering\/(?:Pass|RenderPass|EffectComposer|ShaderPass|MaskPass|OutputPass|CopyShader|OutputShader|SSAOPass|SSAOShader|SimplexNoise|GLTFLoader|KTX2Loader|WorkerPool|ColorSpaces|BufferGeometryUtils)\.js$|rendering\/(?:meshopt_decoder|ktx-parse|zstddec)\.module\.js$|rendering\/basis\/basis_transcoder\.(?:js|wasm)$|assets\/)/.test(pathname)){res.writeHead(404).end();return;}
  }
  else if(['/','/mobile.html','/desktop.html'].includes(pathname)){
   const html=renderWorldDocument(fs.readFileSync(path.join(brandOpening,'home.html'),'utf8'),publicConfig);
   res.writeHead(200,{'Content-Type':mime['.html'],'Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:html);return;
  }
  if(pathname.endsWith('/'))pathname+='index.html';const target=path.resolve(base,'.'+pathname);const rel=path.relative(base,target);
  if(rel.startsWith('..')||path.isAbsolute(rel)||rel.split(path.sep).some(p=>p.startsWith('.'))||!mime[path.extname(target)]||/^(qa|server|prepare-assets|asset-sources|README)/i.test(rel)){res.writeHead(403).end();return;}
  const stat=fs.statSync(target);if(!stat.isFile()){res.writeHead(404).end();return;}
  let start=0,end=stat.size-1,status=200;const headers={'Content-Type':mime[path.extname(target)],'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes'};
  if(req.headers.range){const range=req.headers.range.match(/^bytes=(\d+)-(\d*)$/);if(!range){res.writeHead(416).end();return;}start=+range[1];end=range[2]?Math.min(+range[2],end):end;if(start>end){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`}).end();return;}status=206;headers['Content-Range']=`bytes ${start}-${end}/${stat.size}`;}
  headers['Content-Length']=end-start+1;res.writeHead(status,headers);if(req.method==='HEAD')res.end();else{const stream=fs.createReadStream(target,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);}
 }catch(error){if(res.headersSent){res.destroy();return;}json(res,error.status||500,{ok:false,error:{code:error.code==='AUTH_REQUIRED'?'AUTH_REQUIRED':error.status===413?'PAYLOAD_TOO_LARGE':'REHEARSAL_UNAVAILABLE'}});}
});
server.listen(port,'127.0.0.1',()=>console.log(`WORLD local app: http://127.0.0.1:${port}/mobile.html (synthetic accounts, no production access)`));
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.close(async()=>{await database?.close();process.exit(0);}));
