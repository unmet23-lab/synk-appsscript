// Actual family-album UI with synthetic auth, memory outbox and isolated QA IndexedDB.
import fs from 'node:fs/promises';
import {createServer} from '../../../../experiences/family-album/server.mjs';
const html=(await fs.readFile(new URL('../../../../experiences/family-album/index.html',import.meta.url),'utf8')).replace('src="app.mjs"','src="qa-init.mjs"');
const fixture=`
const memory=()=>{const values=new Map();return {get length(){return values.size;},key:i=>[...values.keys()][i]??null,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};};
Object.defineProperty(window,'localStorage',{value:memory()});Object.defineProperty(window,'sessionStorage',{value:memory()});
const nativeDB=window.indexedDB,qaDB='synk-round8-'+crypto.randomUUID();Object.defineProperty(window,'indexedDB',{value:{open:(_name,version)=>nativeDB.open(qaDB,version)}});
let owner='synthetic-round8-a',generation=1,phase='signed-in',revision=0,saves=0;
let state={format:'synk-family-album-manifest',version:1,pages:[]};
const listeners=new Set(),status=()=>({configured:true,signedIn:phase==='signed-in',status:phase,sessionGeneration:generation,account:phase==='signed-in'||phase==='restoring'?{synk_user_id:owner,display_name:'합성 검수'}:null,error:phase==='error'?{code:'NETWORK',message:'합성 검수: 연결을 잠시 확인하지 못했어요.',retryable:true}:null});
const emit=()=>{for(const fn of listeners)fn(status());};
window.qaRound8={disconnect(){phase='restoring';emit();phase='error';emit();},proof(){return {owner,phase,generation,revision,saves};},cleanup(){nativeDB.deleteDatabase(qaDB);}};
const bridge={getEnvironment:async()=>({clientId:'family-album'}),onAuthChanged:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},authStatus:async()=>status(),authSignIn:async()=>{throw Error('OAuth is disabled in this synthetic QA');},authSignOut:async()=>{owner=null;phase='signed-out';generation++;emit();return {ok:true,serverRevoked:true};},
request:async(action,body={})=>{if(action==='load'){phase='signed-in';generation++;emit();return {ok:true};}if(phase!=='signed-in')return {ok:false,error:{code:'NETWORK',retryable:true}};if(action==='personalSave'){if(body.expected_revision!==revision)return {ok:false,error:{code:'REVISION_CONFLICT'},revision};state=structuredClone(body.state);revision++;saves++;}else if(action!=='personalLoad')throw Error('Unexpected synthetic operation');return {ok:true,scope:'synk-personal',resource:'family-album',accountId:owner,revision,state:structuredClone(state)};}};
window.synkProduct=bridge;window.synkPersonalAccount=bridge;
await import('./app.mjs');
`;
const server=createServer({port:4328,accountConfig:{version:1}});
const [serve]=server.listeners('request');server.removeAllListeners('request');
server.on('request',(req,res)=>{
  const pathname=new URL(req.url,'http://127.0.0.1:4328').pathname;
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  if(['/','/index.html','/qa-init.mjs'].includes(pathname)){
    res.writeHead(200,{'Content-Type':pathname==='/qa-init.mjs'?'text/javascript; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-store',
      'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self' blob: data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});
    res.end(req.method==='HEAD'?undefined:pathname==='/qa-init.mjs'?fixture:html);return;
  }
  void serve(req,res);
});
await server.start();console.log(JSON.stringify({url:'http://127.0.0.1:4328/',pid:process.pid,synthetic:true}));
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await server.stop();process.exit(0);});
