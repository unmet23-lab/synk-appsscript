// Actual album UI and account adapter; only the native bridge and storage are synthetic.
import fs from 'node:fs/promises';
import {createServer} from '../../../../experiences/family-album/server.mjs';
const guestMode=process.argv.includes('--guest'),port=guestMode?4329:4328;
const html=(await fs.readFile(new URL('../../../../experiences/family-album/index.html',import.meta.url),'utf8')).replace('src="app.mjs"','src="qa-init.mjs"');
const fixture=`
const memory=()=>{const values=new Map();return {get length(){return values.size;},key:i=>[...values.keys()][i]??null,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};};
Object.defineProperty(window,'localStorage',{value:memory()});Object.defineProperty(window,'sessionStorage',{value:memory()});
const nativeDB=window.indexedDB,qaDB='synk-round9-'+crypto.randomUUID();Object.defineProperty(window,'indexedDB',{value:{open:(_name,version)=>nativeDB.open(qaDB,version)}});
let deviceAlbum=null,holdDevice=false,finishDevice=null;
window.qaRound9Device={async load(){return structuredClone(deviceAlbum);},async save(value){const saved=structuredClone(value);if(holdDevice){holdDevice=false;await new Promise(resolve=>{finishDevice=resolve;});finishDevice=null;}deviceAlbum=saved;},async remove(){deviceAlbum=null;},holdNext(){holdDevice=true;},finish(){finishDevice?.();},proof(){return {pending:!!finishDevice,titles:deviceAlbum?.pages.map(page=>page.title)||[]};}};
let owner='synthetic-round9-a',generation=1,phase='${guestMode?'signed-out':'signed-in'}',reconnect=null;const calls=[];
const listeners=new Set(),status=()=>({configured:true,signedIn:phase==='signed-in',status:phase,sessionGeneration:generation,account:phase==='signed-in'?{synk_user_id:owner,display_name:owner.endsWith('-b')?'새 계정 검수':'이전 계정 검수'}:null,error:phase==='error'?{code:'NETWORK',message:'합성 검수: 이전 계정의 연결을 확인하지 못했어요.',retryable:true}:null});
const emit=()=>{for(const fn of listeners)fn(status());};
const state=()=>({format:'synk-family-album-manifest',version:1,pages:[{id:'qa-page',title:owner.endsWith('-b')?'새 계정의 가족 이야기':'이전 계정의 가족 이야기',date:'',person:'검수용 가족',author:'합성 검수',story:'계정이 바뀐 뒤에는 이전 연결 결과가 이 기록과 저장 상태를 바꾸지 않아야 해요.',photo:null,audio:null,details:{},skipped:[],contributions:[],createdAt:'2026-10-08T00:00:00.000Z',updatedAt:'2026-10-08T00:00:00.000Z'}]});
window.qaRound9={fail(){phase='error';generation++;emit();},loginB(){owner='synthetic-round9-b';phase='signed-in';generation++;emit();},finishOld(){const finish=reconnect;reconnect=null;finish?.({ok:false,error:{code:'NETWORK',message:'늦게 도착한 이전 연결 실패',retryable:true}});},proof(){return {owner,phase,generation,pendingReconnect:!!reconnect,calls:[...calls]};},cleanup(){return new Promise((resolve,reject)=>{const req=nativeDB.deleteDatabase(qaDB);req.onsuccess=()=>resolve(true);req.onerror=()=>reject(req.error);});}};
const bridge={getEnvironment:async()=>({clientId:'family-album'}),onAuthChanged:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},authStatus:async()=>status(),authSignIn:async()=>{throw Error('OAuth is disabled in this synthetic QA');},authSignOut:async()=>{phase='signed-out';generation++;emit();return {ok:true,serverRevoked:true};},request:async(action)=>{calls.push({action,owner,phase});if(action==='load')return new Promise(resolve=>{reconnect=resolve;});if(action!=='personalLoad')throw Error('Only synthetic reads allowed');return {ok:true,scope:'synk-personal',resource:'family-album',accountId:owner,revision:0,state:state()};}};
window.synkProduct=bridge;window.synkPersonalAccount=bridge;
await import('./app.mjs');
`;
const server=createServer({port,accountConfig:{version:1}});
const [serve]=server.listeners('request');server.removeAllListeners('request');
server.on('request',(req,res)=>{
  const pathname=new URL(req.url,'http://127.0.0.1:4328').pathname;
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  if(guestMode&&pathname==='/storage.mjs'){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'});res.end('export function createStorage(){return window.qaRound9Device;}');return;}
  if(['/','/index.html','/qa-init.mjs'].includes(pathname)){
    res.writeHead(200,{'Content-Type':pathname==='/qa-init.mjs'?'text/javascript; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-store',
      'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self' blob: data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});
    res.end(req.method==='HEAD'?undefined:pathname==='/qa-init.mjs'?fixture:html);return;
  }
  void serve(req,res);
});
await server.start();console.log(JSON.stringify({url:`http://127.0.0.1:${port}/`,pid:process.pid,synthetic:true,guestMode}));
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await server.stop();process.exit(0);});
