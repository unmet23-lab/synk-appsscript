'use strict';
// Shared by pulse-app.test.cjs and pulse-auth-renewal.test.cjs; not a test file itself. A stand-in for the document
// in a PULSE window, with the window's private preload (src/pulse-invite-preload.cjs) run over it exactly as written,
// and the IPC pair that reaches pulse-app.cjs's handlers the way Electron's webContents.ipc does. IPC values cross as
// structured clones, and a window message reaches every listener of the window, the preload's and the page's, in a
// later task.
const assert=require('node:assert/strict'),{EventEmitter}=require('node:events'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{randomUUID}=require('node:crypto');
const PRELOAD_FILE=path.join(__dirname,'../src/pulse-invite-preload.cjs'),PRELOAD=fs.readFileSync(PRELOAD_FILE,'utf8');
const CHANNEL='synk.company.entry',ORIGIN='https://workspace.synk.im',RECEIVER='data-pulse-invite-receiver';

// The document as a PULSE app that keeps the receiver contract stated in the preload (company-entry-contract-v1 §3):
// at boot it attaches its message receiver, sets <html data-pulse-invite-receiver="2"> and posts ready with a fresh
// documentId. It takes only a bind of exactly {channel,version,type,requestId,accountGeneration,documentId,
// phase:'deliver',expectedAccountId} for that documentId and answers bound with phase 'deliver'. It takes only an offer
// of exactly {channel,version,type,requestId,accountGeneration,documentId,token} for that binding, keeps the token
// (pendingInvite) and only then posts received. A bind or offer of any other shape is left in strays, unanswered.
// Options:
//   receiver:false is today's app.mjs, which declares nothing and answers nothing.
//   ready:false declares the receiver but posts no ready; the test posts one with announce() or post().
//   bind:false never answers a bind.
//   boundAs reshapes the bound message before it is posted (a test of a bound in another form).
//   refuse:{at:'bind'|'offer',code,retryable} answers that message with the contract's error instead, keeping nothing.
//   answer is what it posts once it kept the token: null posts nothing, and an object is laid over the received message.
//   stall:true is a busy page that gets to an offer message only when the test calls resume().
//   drift is a hash the page moves to once it kept the token, with a hashchange and the old receipt DOM event instead
//   of the received message.
// received lists the tokens the page kept; commits lists main's answers to the preload's commit requests; binds lists
// the bind messages the page took; posted lists every window message as [data, targetOrigin], and postedOf(type) the
// messages of one type. The page takes no cancel message: a test reads what the preload posted.
const BIND_KEYS=['channel','version','type','requestId','accountGeneration','documentId','phase','expectedAccountId'],OFFER_KEYS=['channel','version','type','requestId','accountGeneration','documentId','token'];
const exactKeys=(data,keys)=>!!data&&typeof data==='object'&&!Array.isArray(data)&&Reflect.ownKeys(data).length===keys.length&&keys.every(key=>Object.hasOwn(data,key));
function fakePage(href,{receiver=true,ready=true,bind=true,boundAs=value=>value,refuse=null,answer={},stall=false,drift=null}={}){
  // channels holds the preload's listeners for what main sends this window: the offer and, on a cancel, the abort.
  let url=new URL(href),channels=new Map(),binding=null;
  const listeners=new Map(),received=[],commits=[],binds=[],strays=[],posted=[],stalled=[],attributes=new Map(),documentId=randomUUID();
  const on=(type,listener)=>{if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(listener);};
  const off=(type,listener)=>{listeners.get(type)?.delete(listener);};
  const fire=(type,event)=>{for(const listener of [...(listeners.get(type)||[])])listener(event);};
  const dispatch=(data,origin,source)=>{const event={type:'message',data:structuredClone(data),origin,source};setImmediate(()=>fire('message',event));};
  // The window both worlds share.
  const win={addEventListener:on,removeEventListener:off,postMessage(data,targetOrigin){posted.push([structuredClone(data),targetOrigin]);if(targetOrigin===url.origin)dispatch(data,url.origin,win);}};
  const location={get origin(){return url.origin;},get pathname(){return url.pathname;},get search(){return url.search;},get hash(){return url.hash;},get href(){return url.href;}};
  const document={documentElement:{getAttribute:name=>attributes.has(name)?attributes.get(name):null}};
  const message=(type,fields)=>({channel:CHANNEL,version:1,type,documentId,...fields});
  // The page's own receiver, as app.mjs would attach it.
  const receive=event=>{
    const data=event.data;
    if(event.source!==win||event.origin!==ORIGIN||data?.channel!==CHANNEL||data.version!==1||data.documentId!==documentId)return;
    if(data.type==='bind'){
      if(!exactKeys(data,BIND_KEYS)||data.phase!=='deliver'){strays.push(data);return;}
      binds.push(data);binding={requestId:data.requestId,accountGeneration:data.accountGeneration};
      if(refuse?.at==='bind'){const ids=binding;binding=null;win.postMessage(message('error',{...ids,code:refuse.code,retryable:refuse.retryable}),ORIGIN);return;}
      if(bind)win.postMessage(boundAs(message('bound',{...binding,phase:'deliver'})),ORIGIN);
      return;
    }
    if(data.type!=='offer')return;
    if(!exactKeys(data,OFFER_KEYS)||typeof data.token!=='string'){strays.push(data);return;}
    if(!binding||data.requestId!==binding.requestId||data.accountGeneration!==binding.accountGeneration)return;
    if(refuse?.at==='offer'){binding=null;win.postMessage(message('error',{requestId:data.requestId,accountGeneration:data.accountGeneration,code:refuse.code,retryable:refuse.retryable}),ORIGIN);return;}
    const take=()=>{
      const ids={requestId:data.requestId,accountGeneration:data.accountGeneration};received.push(data.token);binding=null;
      if(drift){url.hash=drift;fire('hashchange',{type:'hashchange'});fire('pulse-invite-received',{type:'pulse-invite-received',detail:ids.requestId});return;}
      if(answer)win.postMessage({...message('received',{...ids,kind:'customer',destination:'/pulse-app/',state:'queued'}),...answer},ORIGIN);
    };
    if(stall)stalled.push(take);else take();
  };
  const page={received,commits,binds,strays,posted,documentId,window:win,get href(){return url.href;},
    // A message posted to this window, by the page itself unless the test names another origin or source.
    post(data,{origin=url.origin,source=win}={}){dispatch(data,origin,source);},
    announce(){win.postMessage(message('ready',{documentRole:'customer'}),ORIGIN);},
    resume(){while(stalled.length)stalled.shift()();},
    hide(){fire('pagehide',{type:'pagehide'});},
    // Electron runs the window's preload once in each document it loads, before the page's own scripts.
    attach(contents){
      channels=new Map();
      const ipcRenderer={
        on:(channel,listener)=>{channels.set(channel,listener);},
        send:(channel,...args)=>{const copy=structuredClone(args);setImmediate(()=>contents.ipc.emit(channel,{sender:contents,senderFrame:contents.mainFrame},...copy));},
        sendSync:(channel,...args)=>{const event={sender:contents,senderFrame:contents.mainFrame};contents.ipc.emit(channel,event,...structuredClone(args));const answer=event.returnValue??null;commits.push(answer);return structuredClone(answer);},
      };
      vm.runInContext(PRELOAD,vm.createContext({require:id=>{assert.equal(id,'electron');return {ipcRenderer};},window:win,location,document,setTimeout,clearTimeout}),{filename:PRELOAD_FILE});
      if(!receiver)return;
      on('message',receive);attributes.set(RECEIVER,'2');if(ready)page.announce();
    },
    // What main sent this window reaches the preload's listener for that channel, if it has one.
    deliver(channel,args){channels.get(channel)?.({},...structuredClone(args));},
    // The window messages of one type the page was posted, the contract §3 cancel included.
    postedOf(type){return posted.filter(([data])=>data?.type===type).map(([data])=>data);},
  };
  return page;
}
// When the window's renderer gets to what main sent it: at once, or, held, only when a test lets a busy page run it.
const liveRenderer=run=>setImmediate(run);
function heldRenderer(){const waiting=[];return {renderer:run=>{waiting.push(run);},release(){waiting.shift()();},releaseAll(){while(waiting.length)waiting.shift()();},get count(){return waiting.length;}};}
// A BrowserWindow's webContents and its preload's IPC pair. window.sent records what main sent the renderer.
function pulseContents(window,{renderer=liveRenderer}={}){
  const contents=new EventEmitter();
  Object.assign(contents,{ipc:new EventEmitter(),mainFrame:{parent:null,get url(){return window.page?window.page.href:window.url;}},
    getURL:()=>window.page?window.page.href:window.url,isLoadingMainFrame:()=>window.loadingMainFrame===true,
    send:(channel,...args)=>{window.sent.push([channel,...args]);renderer(()=>window.page?.deliver(channel,args));},
    setWindowOpenHandler:handler=>{window.popup=handler;},downloadURL:url=>{window.download=url;}});
  return contents;
}
module.exports={fakePage,heldRenderer,pulseContents,PRELOAD_FILE};
