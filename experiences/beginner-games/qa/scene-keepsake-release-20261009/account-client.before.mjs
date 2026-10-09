import {isPlayRecordKey,PLAY_WALLET_KEY} from './play-data.mjs';

const global=globalThis;
let host=null,blocked=false;
// Same-origin WORLD alone owns the authenticated port. Never inspect a parent
// token, copy a session or serialize arbitrary browser storage.
try{let parent=global;for(let i=0;i<6;i++){if(parent.SYNKPlayHost){host=parent.SYNKPlayHost;break;}if(parent.parent===parent)break;parent=parent.parent;}}catch{}
const accountPath=global.location?.pathname?.startsWith('/try/')?'/account/client.html':'/synk-account/client.html';
const loginHref=`${accountPath}?product=world&play=learning-hub`;
const listeners=new Set();
let current=host?.status()||{phase:'guest',pending:0,message:'계정에 이어 저장하려면 SYNK ID로 연결해 주세요. 현재는 이 브라우저의 체험 기록이에요.'};
let readyPromise=null,accountStorage=null;
const guest=()=>global.localStorage;
const keyAllowed=key=>key===PLAY_WALLET_KEY||isPlayRecordKey(key);
const guestStorage=Object.freeze({
  get length(){return Array.from({length:guest().length},(_,i)=>guest().key(i)).filter(keyAllowed).length;},
  key(i){return Array.from({length:guest().length},(_,j)=>guest().key(j)).filter(keyAllowed)[i]??null;},
  getItem(key){if(!keyAllowed(key))throw Error('INVALID_PLAY_KEY');return guest().getItem(key);},
  setItem(key,value){if(!keyAllowed(key))throw Error('INVALID_PLAY_KEY');guest().setItem(key,value);},
  removeItem(key){if(!keyAllowed(key))throw Error('INVALID_PLAY_KEY');guest().removeItem(key);}
});
function state(){return {...current,mode:host?'account':'guest'};}
function update(value){current=value;if(value.phase==='stopped')blocked=true;render();for(const fn of listeners)try{fn(state());}catch{}global.dispatchEvent?.(new CustomEvent('synk:play-account-change',{detail:state()}));}
function ready(){if(blocked)return Promise.reject(Error('PLAY_SESSION_ENDED'));if(!readyPromise)readyPromise=host?host.ready().then(()=>{update(host.status());return state();}).catch(cause=>{update(host.status());readyPromise=null;throw cause;}):Promise.resolve(state());return readyPromise;}
let panel,label,action;
function render(){
  if(!global.document?.body)return;
  if(!panel){panel=document.createElement('aside');panel.className='synk-play-account';panel.setAttribute('aria-label','게임 계정 저장');label=document.createElement('span');label.setAttribute('role','status');label.setAttribute('aria-live','polite');action=document.createElement('a');panel.append(label,action);document.body.prepend(panel);
    const style=document.createElement('style');style.textContent='.synk-play-account{position:relative;z-index:50;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:6px 18px;padding:8px 16px;background:#f9f4e9;color:#403e38;border-bottom:1px solid #dacfb9;font:500 12px/1.5 system-ui,sans-serif}.synk-play-account a{font-weight:700;color:#315e55;text-decoration:underline;text-underline-offset:3px;cursor:pointer}.synk-play-account[data-phase="offline"],.synk-play-account[data-phase="conflict"]{background:#fff0d7}.synk-play-account a[hidden]{display:none}';document.head.append(style);
  }
  panel.dataset.phase=current.phase;
  const english={guest:'Sign in to keep your progress across devices.',synced:'Saved to your SYNK account.',saving:'Saving to your account…',loading:'Loading your account…',offline:'Not saved to your account yet. Retry when connected.',conflict:'Choose which progress to keep on your account page.',stopped:'Account connection ended.'};
  label.textContent=current.message+' / '+(current.phase==='synced'&&current.rejected?'Connected. Unprocessed requests are kept on this device; other progress can still be saved.':english[current.phase]||'');
  action.hidden=false;
  if(!host){action.textContent='SYNK ID로 이어 하기 · Sign in';action.href=loginHref;action.target='_top';action.onclick=null;}
  else if(['offline','conflict','stopped'].includes(current.phase)){action.textContent=current.phase==='offline'?'저장 다시 시도':'계정에서 저장 상태 확인';action.href=loginHref;action.target='_top';action.onclick=current.phase==='offline'?event=>{event.preventDefault();void host.retry().then(()=>update(host.status())).catch(()=>update(host.status()));}:null;}
  else{action.hidden=true;action.removeAttribute('href');action.onclick=null;}
}
global.SynkPlayAccount=Object.freeze({ready,storage(){if(blocked)throw Error('PLAY_SESSION_ENDED');return host?(accountStorage||=host.storage()):guestStorage;},status:state,subscribe(fn){listeners.add(fn);fn(state());return()=>listeners.delete(fn);},loginHref,
  async wallet(method,args){await ready();if(!host)throw Error('PLAY_GUEST');return host.wallet(method,args);},
  async retry(){if(host)await host.retry();return state();}
});
let unsubscribe=host?.subscribe(update);
global.addEventListener?.('pagehide',()=>{unsubscribe?.();unsubscribe=null;});
global.addEventListener?.('pageshow',()=>{if(host&&!unsubscribe)try{unsubscribe=host.subscribe(update);}catch{update({phase:'stopped',message:'계정 연결이 종료됐어요. SYNK ID로 다시 연결해 주세요.'});}});
if(global.document?.readyState==='loading')document.addEventListener('DOMContentLoaded',render,{once:true});else render();
global.addEventListener?.('online',()=>{if(host)void host.retry().catch(()=>{});});
void ready().catch(()=>{});
