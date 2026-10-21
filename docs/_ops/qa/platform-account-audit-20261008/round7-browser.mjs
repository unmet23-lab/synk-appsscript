// Real Care app, synthetic account/status controls and in-memory records only.
import fs from 'node:fs/promises';
import {createServer} from '../../../../experiences/relationship-care/server.mjs';
const appRoot=new URL('../../../../experiences/relationship-care/',import.meta.url);
const html=(await fs.readFile(new URL('index.html',appRoot),'utf8')).replace('src="app.mjs"','src="qa-init.mjs"');
const fixture=`
import {emptyState,makePerson,importBackup} from './model.mjs';
const memory=()=>{const entries=new Map();return {get length(){return entries.size;},key:i=>[...entries.keys()][i]??null,getItem:k=>entries.get(k)??null,setItem:(k,v)=>entries.set(k,String(v)),removeItem:k=>entries.delete(k)};};
Object.defineProperty(window,'localStorage',{value:memory()});Object.defineProperty(window,'sessionStorage',{value:memory()});
let owner='synthetic-round7-a',generation=1,revision=1,phase='signed-in',saves=0;
let state={...emptyState(),people:[makePerson({id:'synthetic-person',name:'검수 예시',relationship:'친구'})]};
const listeners=new Set(),status=()=>({configured:true,signedIn:phase==='signed-in',status:phase,sessionGeneration:generation,account:phase==='signed-in'||phase==='restoring'?{synk_user_id:owner,display_name:'합성 검수'}:null,error:phase==='error'?{code:'NETWORK',message:'합성 검수: 계정 연결이 잠시 끊겼어요.',retryable:true}:null});
const emit=()=>{for(const fn of listeners)fn(status());};
window.qaRound7={disconnect(){phase='restoring';emit();phase='error';emit();},switchAccount(){owner='synthetic-round7-b';generation++;phase='signed-in';state={...emptyState(),people:[makePerson({id:'synthetic-b-person',name:'두 번째 검수 계정',relationship:'친구'})]};emit();},proof(){return {owner,phase,generation,revision,saves};}};
window.synkProduct={getEnvironment:async()=>({clientId:'care',synthetic:true}),authStatus:async()=>status(),onAuthChanged:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},authSignIn:async()=>{throw new Error('QA must recover the saved account without OAuth');},authSignOut:async()=>{owner=null;phase='signed-out';generation++;emit();return {ok:true,serverRevoked:true};},
accountRequest:async(action,body={})=>{if(action==='load'){phase='restoring';emit();phase='signed-in';generation++;emit();return {ok:true};}if(phase!=='signed-in'||!owner)return {ok:false,error:{code:'NETWORK',retryable:true}};if(action!=='careLoad'){if(body.expected_revision!==revision)return {ok:false,error:{code:'REVISION_CONFLICT',status:409}};state=action==='careDelete'?null:importBackup(body.state);revision++;saves++;}return {ok:true,scope:'synk-care',accountId:owner,revision,state:structuredClone(state)};}};
await import('./app.mjs');
`;
const server=createServer({port:4328,accountConfigPath:new URL('./synthetic-config-not-used.json',import.meta.url).pathname,
  transcriber:{status:async()=>({available:false,reason:'synthetic-qa'}),close:async()=>{}}});
const [serve]=server.listeners('request');server.removeAllListeners('request');
server.on('request',(req,res)=>{
  const pathname=new URL(req.url,'http://127.0.0.1:4328').pathname;
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  if(pathname==='/'||pathname==='/index.html'||pathname==='/qa-init.mjs'){
    res.writeHead(200,{'Content-Type':pathname==='/qa-init.mjs'?'text/javascript; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-store',
      'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});
    res.end(req.method==='HEAD'?undefined:pathname==='/qa-init.mjs'?fixture:html);return;
  }
  void serve(req,res);
});
await server.start();console.log(JSON.stringify({url:'http://127.0.0.1:4328/',pid:process.pid,synthetic:true}));
