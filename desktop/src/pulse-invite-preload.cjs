'use strict';
// The PULSE customer window's own preload (pulse-app.cjs), run in its isolated world. It gives the page nothing: no
// global, no bridge and no channel the page can reach. It carries one invite hand-off at a time from main to the
// document's in-memory receiver, by messages on this same window only. The token never enters an address, storage,
// window.name, a log or a report.
//
// The web messages are those of company-entry-contract-v1 §3, exactly. Each is a plain object with
// channel:'synk.company.entry', version:1 and its type, goes to this same window for the exact company origin, and has
// exactly these keys. A message with a key missing or added, another phase or another value is refused:
//   ready     document → here  {channel,version,type:'ready',documentId,documentRole:'customer'}
//   bind      here → document  {channel,version,type:'bind',requestId,accountGeneration,documentId,phase:'deliver',expectedAccountId}
//   bound     document → here  {channel,version,type:'bound',requestId,accountGeneration,documentId,phase:'deliver'}
//   offer     here → document  {channel,version,type:'offer',requestId,accountGeneration,documentId,token}
//   received  document → here  {channel,version,type:'received',requestId,accountGeneration,documentId,kind:'customer',destination:'/pulse-app/',state:'queued'}
//   error     document → here  {channel,version,type:'error',requestId,accountGeneration,documentId,code,retryable}
//   cancel    here → document  {channel,version,type:'cancel',requestId,accountGeneration,documentId}
// The customer document only ever takes the deliver phase. requestId, accountGeneration and documentId are lowercase
// UUIDs of versions 1 to 8 with the RFC variant; auth issues v4 today, and another valid version is not refused.
// Once its message receiver is attached the document sets <html data-pulse-invite-receiver="2"> and posts ready with
// a fresh documentId. It answers bind with bound, keeps the offered token in its pendingInvite and only then posts
// received. An address change, a hashchange or a DOM event is no answer. A document that declares no receiver is
// handed nothing, and main reports PULSE_APP_INVITE_RECEIVER_UNAVAILABLE.
//
// Main offers {id,requestId,accountGeneration,expectedAccountId}, never the token. Only once the ready document is
// bound does a synchronous request {id,requestId,accountGeneration,documentId} ask main for the token, and main checks
// the offer, this frame, the account, its generation and the epoch right then, however late this runs. Its answer
// {id,requestId,accountGeneration,documentId,token} comes once and goes only to the bound document; a refusal is null
// and the document is handed nothing. The page runs nothing between that answer and the offer message. Each hand-off
// ends in one report {id,requestId,accountGeneration,documentId,outcome}; documentId is null only when no document was
// ready. Once the token has left main, no received by the wait, or an error from the document, is 'not-received',
// which main keeps as unconfirmed and never sends again.
//
// When the portal cancels the invite, main ends the hand-off itself and then tells this preload, by exactly
// {id,requestId,accountGeneration} on 'synk:pulse-invite-abort'. The preload drops that hand-off at once: it binds
// nothing more for it, never asks main for its token and reports nothing. A document bound to it and not yet handed the
// token is told to drop the binding with the contract §3 cancel. A document already handed the token is left as it is;
// main keeps that hand-off unconfirmed and does not claim it undone.
const {ipcRenderer}=require('electron');
const ORIGIN='https://workspace.synk.im',SHELL='/pulse-app/',DEMO='?demo=coffee',CHANNEL='synk.company.entry',RECEIVER='data-pulse-invite-receiver',CAPABILITY='2',PHASE='deliver';
const ID=/^[A-Za-z0-9_-]{32}$/,UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,ACCOUNT=/^[a-zA-Z0-9_.-]{1,120}$/,TOKEN=/^[A-Za-z0-9_-]{16,200}$/;
const ERRORS=new Set(['INVALID_INPUT','INVITE_REJECTED','TEMPORARY_UNAVAILABLE','RATE_LIMITED','ACCOUNT_CHANGED','ACCOUNT_MISMATCH','BUSY','CANCELLED','HANDOFF_TIMEOUT','HANDOFF_UNAVAILABLE']);
// How long a hand-off waits for the document's ready, then for each answer. Main keeps one bound of its own for the
// whole hand-off and refuses the token once that has passed.
const READY_WAIT=1500,ANSWER_WAIT=1500;
const exact=(value,keys)=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Reflect.ownKeys(value).length===keys.length&&keys.every(key=>Object.prototype.hasOwnProperty.call(value,key));
const uuid=value=>typeof value==='string'&&UUID.test(value);
const entry=(data,type,keys)=>exact(data,['channel','version','type',...keys])&&data.channel===CHANNEL&&data.version===1&&data.type===type;
const post=(type,fields)=>window.postMessage({channel:CHANNEL,version:1,type,...fields},ORIGIN);
// The document this runs in: the customer shell, its demo, or another page.
const page=()=>{const l=location;if(l.origin!==ORIGIN||l.pathname!==SHELL)return null;if(l.search===DEMO)return 'demo';return l.search?null:'shell';};
const capable=()=>page()==='shell'&&document.documentElement?.getAttribute(RECEIVER)===CAPABILITY;
// ready is the receiver the document declared last. seen holds every documentId it declared, so none counts twice.
let ready=null,active=null;const seen=new Set();
const start=offer=>{
  active?.end();
  const ids={id:offer.id,requestId:offer.requestId,accountGeneration:offer.accountGeneration},handoff={};
  let documentId=null,stage='waiting',timer=null;
  active=handoff;
  const stop=()=>{stage='done';clearTimeout(timer);if(active===handoff)active=null;};
  const report=outcome=>{if(stage==='done')return;stop();ipcRenderer.send('synk:pulse-invite-result',{...ids,documentId,outcome});};
  const wait=(ms,outcome)=>{clearTimeout(timer);timer=setTimeout(()=>report(outcome),ms);};
  const same=data=>data.documentId===documentId&&data.requestId===ids.requestId&&data.accountGeneration===ids.accountGeneration;
  const bind=()=>{
    if(!ready||!capable()){report('unavailable');return;}
    documentId=ready.documentId;stage='binding';wait(ANSWER_WAIT,'not-received');
    post('bind',{requestId:ids.requestId,accountGeneration:ids.accountGeneration,documentId,phase:PHASE,expectedAccountId:offer.expectedAccountId});
  };
  // A receiver declared anew: a hand-off waiting for one binds to it, and one bound to the former receiver ends.
  handoff.ready=()=>{if(stage==='waiting')bind();else handoff.end();};
  handoff.bound=data=>{
    if(stage!=='binding'||!same(data)||data.phase!==PHASE)return;
    if(ready?.documentId!==documentId||!capable()){report('unavailable');return;}
    stage='committing';clearTimeout(timer);
    let answer=null;
    try{answer=ipcRenderer.sendSync('synk:pulse-invite-commit',{...ids,documentId});}catch{answer=null;}
    // A refusal is main's own end of this hand-off: the document is handed nothing and nothing more is reported.
    if(answer===null||answer===undefined){stop();return;}
    stage='offered';
    // Any other answer, an old token string included, is no token to hand over.
    if(!exact(answer,['id','requestId','accountGeneration','documentId','token'])||answer.id!==ids.id||!same(answer)||typeof answer.token!=='string'||!TOKEN.test(answer.token)||ready?.documentId!==documentId||!capable()){report('not-received');return;}
    wait(ANSWER_WAIT,'not-received');
    post('offer',{requestId:ids.requestId,accountGeneration:ids.accountGeneration,documentId,token:answer.token});
    answer=null;
  };
  handoff.received=data=>{
    if(stage!=='offered'||!same(data))return;
    report(data.kind==='customer'&&data.destination===SHELL&&data.state==='queued'?'delivered':'not-received');
  };
  // The bound document refused the binding or the offer. Before the token left main that is a failure; after it,
  // main keeps the hand-off unconfirmed, since the document may still hold the token.
  handoff.error=data=>{if((stage==='binding'||stage==='offered')&&same(data))report('not-received');};
  // The document went away, or main offered another hand-off. Before the token left main nothing was handed over.
  handoff.end=()=>report(stage==='offered'||stage==='committing'?'not-received':'unavailable');
  // Main ended this very hand-off because the portal cancelled the invite. Main already holds the answer, so nothing is
  // reported. A document bound but not yet handed the token drops the binding; a later bound asks main for nothing.
  handoff.abort=value=>{
    if(value.id!==ids.id||value.requestId!==ids.requestId||value.accountGeneration!==ids.accountGeneration)return;
    if(stage==='binding')post('cancel',{requestId:ids.requestId,accountGeneration:ids.accountGeneration,documentId});
    stop();
  };
  const where=page();
  if(where==='demo'){report('demo');return;}
  if(where!=='shell'||document.documentElement?.getAttribute(RECEIVER)!==CAPABILITY){report('unavailable');return;}
  if(ready)bind();else wait(READY_WAIT,'unavailable');
};
// Only this window's own messages from the exact origin count; the page's address and DOM events never do.
window.addEventListener('message',event=>{
  if(event.source!==window||event.origin!==ORIGIN)return;
  const data=event.data;
  if(entry(data,'ready',['documentId','documentRole'])){
    if(data.documentRole!=='customer'||!uuid(data.documentId)||seen.has(data.documentId)||!capable())return;
    seen.add(data.documentId);ready={documentId:data.documentId};active?.ready();return;
  }
  if(entry(data,'bound',['requestId','accountGeneration','documentId','phase']))active?.bound(data);
  else if(entry(data,'received',['requestId','accountGeneration','documentId','kind','destination','state']))active?.received(data);
  else if(entry(data,'error',['requestId','accountGeneration','documentId','code','retryable'])&&ERRORS.has(data.code)&&typeof data.retryable==='boolean')active?.error(data);
});
// A document that leaves, or is put away for later, takes its receiver with it.
window.addEventListener('pagehide',()=>{ready=null;active?.end();});
// An offer in any other form, the old single ID string included, starts nothing.
ipcRenderer.on('synk:pulse-invite-offer',(_event,offer)=>{
  if(!exact(offer,['id','requestId','accountGeneration','expectedAccountId'])||typeof offer.id!=='string'||!ID.test(offer.id)||!uuid(offer.requestId)||!uuid(offer.accountGeneration))return;
  if(offer.expectedAccountId!==null&&(typeof offer.expectedAccountId!=='string'||!ACCOUNT.test(offer.expectedAccountId)))return;
  start(offer);
});
// Main's end of the hand-off it offered, exactly {id,requestId,accountGeneration}. Any other form, or one naming
// another hand-off, changes nothing.
ipcRenderer.on('synk:pulse-invite-abort',(_event,value)=>{
  if(!exact(value,['id','requestId','accountGeneration'])||typeof value.id!=='string'||!ID.test(value.id)||!uuid(value.requestId)||!uuid(value.accountGeneration))return;
  active?.abort(value);
});
