import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomInt, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { command, newPlayer, newRoom, project, GameError, requireThat } from './core.mjs';

const DIR=path.dirname(fileURLToPath(import.meta.url));
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.webp':'image/webp','.woff2':'font/woff2','.mp3':'audio/mpeg','.wav':'audio/wav','.txt':'text/plain; charset=utf-8'};
function equal(a,b){return typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));}
function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));}
function canonicalIp(value){
  if(typeof value!=='string'||value.length>64||value.includes('%')||!isIP(value))return null;
  if(isIP(value)===4)return value;
  const normalized=new URL(`http://[${value}]/`).hostname.slice(1,-1),mapped=/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(normalized);
  if(!mapped)return normalized;
  const high=parseInt(mapped[1],16),low=parseInt(mapped[2],16);return [high>>8,high&255,low>>8,low&255].join('.');
}
function exactOrigin(value){try{const url=new URL(value);return url.origin===value&&!url.username&&!url.password&&url.protocol==='https:';}catch{return false;}}
async function body(req){
  requireThat((req.headers['content-type']||'').split(';')[0]==='application/json','CONTENT_TYPE','JSON 요청이 필요해요.',415);
  let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;requireThat(size<=4096,'TOO_LARGE','요청이 너무 커요.',413);chunks.push(chunk);}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new GameError('JSON','요청을 읽지 못했어요.');}
}
export function createRequestHandler({now=Date.now,maxRooms=200,roomTtl=30*60e3,absoluteTtl=2*60*60e3,prefix='/api/spaceship',serveStatic=true,allowedHosts=[],allowedOrigins=[],trustedProxyIps=[],publicMode=false,maxRoomsPerAddress=12,maxRateEntries=4096}={}) {
  const PREFIX=prefix.replace(/\/$/,'');
  if(!Array.isArray(allowedOrigins)||allowedOrigins.some(value=>!exactOrigin(value))||!Array.isArray(trustedProxyIps)||trustedProxyIps.some(value=>!canonicalIp(value)))throw new Error('Use exact HTTPS origins and proxy IP addresses.');
  if(!Array.isArray(allowedHosts)||allowedHosts.some(value=>typeof value!=='string'||!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(value)))throw new Error('Use exact allowed hostnames.');
  if(publicMode&&(serveStatic||!allowedHosts.length||!allowedOrigins.length||!trustedProxyIps.length))throw new Error('Public API needs explicit hosts, origins and proxy peers, with static serving disabled.');
  if(![maxRooms,maxRoomsPerAddress,maxRateEntries].every(value=>Number.isSafeInteger(value)&&value>0))throw new Error('Room and rate limits must be positive integers.');
  const origins=new Set(allowedOrigins),proxies=new Set(trustedProxyIps.map(canonicalIp));
  const rooms=new Map(),streams=new Map(),rates=new Map(),createIds=new Map();
  let closed=false;
  function isExpired(r){return now()-r.lastActive>roomTtl||now()-r.created>absoluteTtl;}
  // Bound slow-client buffers. The client reconnects with the same room token.
  function writeEvent(stream,value){if(!stream||stream.destroyed||stream.writableEnded)return;if(stream.writableLength>128*1024){stream.destroy();return;}stream.write(value);}
  function broadcast(r){r.players.forEach((p,i)=>{const stream=p&&streams.get(p.token);if(stream)writeEvent(stream,`event: state\ndata: ${JSON.stringify(project(r,i,now()))}\n\n`);});}
  function closeRoom(r,event='expired') {for(const p of r.players){const s=p&&streams.get(p.token);if(s){s.write(`event: ${event}\ndata: {}\n\n`);s.end();streams.delete(p.token);}}rooms.delete(r.code);}
  function prune(){for(const r of rooms.values())if(isExpired(r))closeRoom(r);for(const [key,r]of rates)if(now()-r.start>60e3)rates.delete(key);for(const[key,x]of createIds)if(!rooms.has(x.code))createIds.delete(key);}
  const interval=setInterval(()=>{prune();for(const s of streams.values())writeEvent(s,': heartbeat\n\n');},15000);interval.unref();
  function clientAddress(req){
    const peer=canonicalIp(req.socket.remoteAddress)||'unknown';if(!proxies.has(peer))return peer;
    const forwarded=req.headers['x-forwarded-for'];
    // The existing Caddy overwrites this with one address. Never trust a supplied chain.
    requireThat(typeof forwarded==='string'&&!!canonicalIp(forwarded)&&req.rawHeaders.filter((value,index)=>index%2===0&&value.toLowerCase()==='x-forwarded-for').length===1,'PROXY','연결 주소를 확인하지 못했어요.',400);
    return canonicalIp(forwarded);
  }
  function rate(address,category,limit){const key=`${address}:${category}`,t=now();let r=rates.get(key);if(!r||t-r.start>60e3){requireThat(rates.size<maxRateEntries,'RATE_CAPACITY','연결이 많아요. 잠시 뒤 다시 시도해 주세요.',503);r={start:t,count:0};rates.set(key,r);}requireThat(++r.count<=limit,'RATE_LIMIT','잠시 쉬었다 다시 시도해 주세요.',429);}
  function find(code){const r=rooms.get(code);requireThat(r&&!isExpired(r),'ROOM_MISSING','방이 만료되었거나 없어요. 새 탐험을 만들어요.',404);return r;}
  function auth(r,req){const bearer=req.headers.authorization?.replace(/^Bearer /,'');const slot=r.players.findIndex(p=>p&&equal(p.token,bearer));requireThat(slot>=0,'AUTH','이 기기의 입장 정보가 필요해요.',401);return slot;}
  async function handler(req,res){
    const url=new URL(req.url,'http://localhost');
    const isApi=url.pathname===PREFIX||url.pathname.startsWith(PREFIX+'/');
    if(isApi){
      try {
        requireThat(!closed,'SHUTDOWN','서버가 쉬고 있어요. 잠시 뒤 새 탐험을 만들어요.',503);
        const host=req.headers.host||'',parsedHost=new URL(`http://${host}`),hostname=parsedHost.hostname.replace(/^\[|\]$/g,''),health=req.method==='GET'&&url.pathname===`${PREFIX}/health`;
        const local=hostname==='localhost'||!!isIP(hostname),internalHealth=health&&['localhost','127.0.0.1','::1'].includes(hostname)&&['127.0.0.1','::1'].includes(canonicalIp(req.socket.remoteAddress));
        requireThat(parsedHost.host===host.toLowerCase()&&!parsedHost.username&&!parsedHost.password&&((publicMode?allowedHosts.includes(hostname)&&!parsedHost.port:local||allowedHosts.includes(hostname))||internalHealth),'HOST','허용된 게임 주소에서 접속해 주세요.',403);
        const origin=req.headers.origin,sameOrigin=origin===`http://${host}`||origin===`https://${host}`,allowedOrigin=origins.has(origin);
        requireThat(publicMode?(!origin&&health)||allowedOrigin:!origin||sameOrigin||allowedOrigin,'ORIGIN','같은 게임 창에서 다시 시도해 주세요.',403);
        requireThat(req.headers['sec-fetch-site']!=='cross-site'||allowedOrigin,'ORIGIN','다른 사이트에서는 이 방을 조작할 수 없어요.',403);
        res.setHeader('Vary','Origin');
        if(allowedOrigin)res.setHeader('Access-Control-Allow-Origin',origin);
        if(health){json(res,200,{ok:true,service:'spaceship-coop',version:1,storage:'ephemeral',maxRooms});return true;}
        const address=clientAddress(req);prune();rate(address,'api',360);
        if(req.method==='OPTIONS'){
          const method=req.headers['access-control-request-method'],headers=req.headers['access-control-request-headers'];
          requireThat(allowedOrigin&&['GET','POST'].includes(method)&&(!headers||headers.split(',').every(value=>['authorization','content-type'].includes(value.trim().toLowerCase()))),'PREFLIGHT','허용된 게임 요청만 사용할 수 있어요.',403);
          res.writeHead(204,{'Access-Control-Allow-Methods':'GET, POST','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Max-Age':'300','Cache-Control':'no-store'});res.end();return true;
        }
        if(req.method==='POST'&&url.pathname===`${PREFIX}/rooms`){
          rate(address,'create',12);const b=await body(req);requireThat(b&&Object.keys(b).length===1&&typeof b.id==='string'&&/^[A-Za-z0-9_-]{16,80}$/.test(b.id),'SCHEMA','입장 요청 번호가 필요해요.');
          if(createIds.has(b.id)){const previous=createIds.get(b.id);json(res,200,previous);return true;}
          requireThat(rooms.size<maxRooms,'CAPACITY','지금은 방이 가득 찼어요.',503);
          requireThat([...rooms.values()].filter(room=>room.creatorAddress===address&&!['closed','complete'].includes(room.phase)).length<maxRoomsPerAddress,'ROOM_LIMIT','진행 중인 탐험을 마친 뒤 새 탐험을 만들어요.',429);
          let code;do{code=Array.from({length:6},()=>alphabet[randomInt(alphabet.length)]).join('');}while(rooms.has(code));
          const r=newRoom(code,now());r.creatorAddress=address;rooms.set(code,r);const result={code,token:r.players[0].token,slot:0};createIds.set(b.id,result);json(res,201,result);return true;
        }
        const match=url.pathname.slice(PREFIX.length).match(/^\/rooms\/([A-Z2-9]{6})(?:\/(join|state|events|commands))?$/);
        requireThat(match,'NOT_FOUND','없는 경로예요.',404);const r=find(match[1]),action=match[2];
        if(action==='join'&&req.method==='POST'){
          rate(address,'join',30);const b=await body(req);requireThat(b&&Object.keys(b).length===1&&typeof b.id==='string'&&/^[A-Za-z0-9_-]{16,80}$/.test(b.id),'SCHEMA','입장 요청 번호가 필요해요.');
          if(r.joinId===b.id){json(res,200,{code:r.code,token:r.players[1].token,slot:1});return true;}
          requireThat(r.phase==='lobby'&&!r.players[1],'FULL','두 사람이 이미 들어왔어요. 원래 기기에서는 이어 할 수 있어요.',409);
          r.players[1]=newPlayer(1);r.joinId=b.id;r.revision++;r.lastActive=now();broadcast(r);json(res,201,{code:r.code,token:r.players[1].token,slot:1});return true;
        }
        const slot=auth(r,req),p=r.players[slot];
        if(action==='state'&&req.method==='GET'){json(res,200,project(r,slot,now()));return true;}
        if(action==='events'&&req.method==='GET'){
          requireThat(r.phase!=='closed','CLOSED','탐험이 끝났어요.',410);
          const old=streams.get(p.token);if(old){old.write('event: replaced\ndata: {}\n\n');old.end();}
          res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store','Connection':'keep-alive','X-Accel-Buffering':'no','X-Content-Type-Options':'nosniff'});res.flushHeaders();
          streams.set(p.token,res);p.connected=true;r.lastActive=now();broadcast(r);
          req.on('close',()=>{if(streams.get(p.token)===res){streams.delete(p.token);p.connected=false;broadcast(r);}});return true;
        }
        if(action==='commands'&&req.method==='POST'){
          const changed=command(r,slot,await body(req),now());if(changed)broadcast(r);json(res,200,project(r,slot,now()));return true;
        }
        throw new GameError('METHOD','이 요청은 사용할 수 없어요.',405);
      }catch(e){if(!res.headersSent)json(res,e instanceof GameError?e.status:500,{error:e instanceof GameError?e.code:'INTERNAL',message:e instanceof GameError?e.message:'연결 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.'});return true;}
    }
    if(!serveStatic)return false;
    const mount='/experiences/spaceship-coop/';let rel=url.pathname.startsWith(mount)?url.pathname.slice(mount.length):url.pathname.slice(1);
    if(url.pathname==='/experiences/spaceship-coop'){res.writeHead(302,{Location:mount});res.end();return true;}
    if(rel==='')rel='index.html';
    // Deliberate allowlist: never serve the server/core source, tests, QA data or credentials.
    if(!['index.html','style.css','app.mjs','audio.mjs','collection.js','shop.mjs','shop.css','starbook.mjs'].includes(rel)&&!/^assets\/[a-zA-Z0-9_./-]+$/.test(rel))return false;
    if(!['GET','HEAD'].includes(req.method)){json(res,405,{error:'METHOD'});return true;}
    const target=path.resolve(DIR,rel);if(!target.startsWith(DIR+path.sep)||rel.split('/').includes('..')){json(res,403,{error:'PATH'});return true;}
    try{const info=await stat(target);if(!info.isFile())return false;const data=await readFile(target);
      res.writeHead(200,{'Content-Type':MIME[path.extname(target)]||'application/octet-stream','Content-Length':data.length,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; media-src 'self' blob:; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'"});res.end(req.method==='HEAD'?undefined:data);return true;
    }catch{return false;}
  }
  handler.close=()=>{closed=true;clearInterval(interval);for(const r of rooms.values())closeRoom(r,'shutdown');};
  return handler;
}
export const createRoomHandler=createRequestHandler;
export function createServer(options={}){const handler=createRequestHandler(options);const server=http.createServer({headersTimeout:15000,requestTimeout:20000,maxHeaderSize:8192},async(req,res)=>{try{if(!await handler(req,res))json(res,404,{error:'NOT_FOUND'});}catch{if(!res.headersSent)json(res,500,{error:'INTERNAL'});else res.end();}});server.maxConnections=512;server.on('close',handler.close);server.closeGame=handler.close;return server;}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const args=process.argv.slice(2);const host=args.includes('--host')?args[args.indexOf('--host')+1]:'127.0.0.1';const port=Number(args.includes('--port')?args[args.indexOf('--port')+1]:4318);
  if(!host||!Number.isInteger(port)||port<1||port>65535)throw new Error('Usage: node server.mjs [--host 127.0.0.1] [--port 4318]');
  const server=createServer();server.listen(port,host,()=>process.stdout.write(`SYNK Spaceship Co-op: http://${host}:${port}/experiences/spaceship-coop/\n`));
  for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>{server.closeGame();server.close(()=>process.exit(0));});
}
