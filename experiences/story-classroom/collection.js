// Generated from korean-racing/garage-core.js and collection-adapter.js. Run node experiences/play-common/build-collection.mjs.
var SynkCollectionEconomy=(()=>{var x=Object.defineProperty;var P=Object.getOwnPropertyDescriptor;var W=Object.getOwnPropertyNames;var Y=Object.prototype.hasOwnProperty;var H=(e,t)=>{for(var n in t)x(e,n,{get:t[n],enumerable:!0})},K=(e,t,n,r)=>{if(t&&typeof t=="object"||typeof t=="function")for(let o of W(t))!Y.call(e,o)&&o!==n&&x(e,o,{get:()=>t[o],enumerable:!(r=P(t,o))||r.enumerable});return e};var B=e=>K(x({},"__esModule",{value:!0}),e);var te={};H(te,{FINALE_REWARDS:()=>U,GARAGE_KEY:()=>_,MINI_GAMES:()=>D,PAINTS:()=>I,REWARDS:()=>w,SHOP_ITEMS:()=>k,TRAILS:()=>G,VEHICLES:()=>y,WHEELS:()=>C,awardMiniGame:()=>ne,buyItem:()=>Z,emptyGarage:()=>A,equipItem:()=>v,integer:()=>s,keepMission:()=>$,loadGarage:()=>Q,normalizeGarage:()=>a,object:()=>d,safeKey:()=>p,saveGarage:()=>X,seoulDate:()=>F,setWish:()=>ee,validTime:()=>q});var _="SYNK_PLAY_COLLECTION_V1",y=[{id:"coast",kind:"coast",name:"\uCF54\uC2A4\uD2B8 GT",price:0,description:"\uCCAB \uBC14\uB2E4 \uC5EC\uD589\uC744 \uD568\uAED8\uD558\uB294 \uC2A4\uD3EC\uCE20\uCE74",color:"#8dc9bc"},{id:"open",kind:"open",name:"\uBE0C\uB9AC\uC988 \uB85C\uB4DC\uC2A4\uD130",price:120,description:"\uC5F4\uB9B0 \uC9C0\uBD95\uC73C\uB85C \uBC14\uB78C\uC744 \uB9CC\uB098\uB294 \uB85C\uB4DC\uC2A4\uD130",color:"#e4b79a"},{id:"rally",kind:"rally",name:"\uD2B8\uB808\uC77C \uB7A0\uB9AC",price:220,description:"\uB113\uC740 \uD39C\uB354\uC640 \uBCF4\uC870\uB4F1\uC744 \uAC16\uCD98 \uB7A0\uB9AC\uCE74",color:"#aebaca"},{id:"finale",kind:"open",name:"\uB9C8\uC2A4\uD130 \uB85C\uB4DC\uC2A4\uD130",price:null,unlockOnly:!0,description:"\uC5EC\uC12F \uBC88\uC9F8 \uCC55\uD130 \uACB0\uC2B9\uC758 \uD2B9\uBCC4 \uC5D0\uB514\uC158",color:"#d6c6a2"}],I=[{id:"mint",name:"\uBBFC\uD2B8",price:0,color:"#8dc9bc"},{id:"coral",name:"\uCF54\uB784",price:35,color:"#d78678"},{id:"pearl",name:"\uC9C4\uC8FC\uBE5B",price:35,color:"#e9e5d9"},{id:"midnight",name:"\uBBF8\uB4DC\uB098\uC774\uD2B8",price:50,color:"#333e5c"},{id:"aurora",name:"\uC624\uB85C\uB77C",price:null,unlockOnly:!0,color:"#6cced2"},{id:"sunset",name:"\uB178\uC744",price:null,unlockOnly:!0,color:"#d88b72"}],C=[{id:"silver",name:"\uC2E4\uBC84",price:0,color:"#c9ced3"},{id:"graphite",name:"\uADF8\uB798\uD30C\uC774\uD2B8",price:45,color:"#4c515a"},{id:"gold",name:"\uC0F4\uD398\uC778 \uACE8\uB4DC",price:70,color:"#c9ac72"},{id:"blossom",name:"\uBC9A\uAF43",price:null,unlockOnly:!0,color:"#efd9cb"}],G=[{id:"lime",name:"\uB77C\uC784 \uBD80\uC2A4\uD130",price:0,color:"#d4ff8a"},{id:"ocean",name:"\uBC14\uB2E4 \uBD80\uC2A4\uD130",price:45,color:"#66cae7"},{id:"sunset",name:"\uB178\uC744 \uBD80\uC2A4\uD130",price:70,color:"#efa577"},{id:"starlight",name:"\uBCC4\uBE5B \uBD80\uC2A4\uD130",price:null,unlockOnly:!0,color:"#ced2ff"}],J={id:"badge-coast",kind:"badge",value:"coast",name:"\uCF54\uC2A4\uD2B8 \uCC54\uD53C\uC5B8",price:null,unlockOnly:!0,color:"#d1e6da",description:"\uB124 \uBC88\uC9F8 \uCC55\uD130 \uACB0\uC2B9 \uAE30\uB150 \uBC30\uC9C0"},h=(e,t)=>t.map(n=>({...n,id:`${e}-${n.id}`,kind:e,value:n.id})),k=[...h("vehicle",y),...h("paint",I),...h("wheels",C).map(e=>e.value==="blossom"?{...e,id:"wheel-blossom"}:e),...h("trail",G),J],U=Object.freeze({1:"paint-aurora",2:"wheel-blossom",3:"trail-starlight",4:"badge-coast",5:"paint-sunset",6:"vehicle-finale"}),M=Object.fromEntries(k.map(e=>[e.id,e])),R=e=>typeof e=="string"&&Object.hasOwn(M,e)?M[e]:null,L=k.filter(e=>e.price===0).map(e=>e.id),T={vehicle:"coast",paint:"mint",wheels:"silver",trail:"lime",badge:null},w=Object.freeze({finish:15,correct:2,firstClear:10,correction:5,mission:15,dailyRaceLimit:10,miniGameAccuracy:10}),D=Object.freeze(["rhythm","runner","blank-slice","entry-check","story-classroom"]),s=(e,t=0,n=1e9)=>typeof e=="number"&&Number.isFinite(e)?Math.max(0,Math.min(n,Math.floor(e))):t,d=e=>e&&typeof e=="object"&&!Array.isArray(e)?e:{},p=e=>typeof e=="string"&&e.length>0&&e.length<=180&&!["__proto__","prototype","constructor"].includes(e),N=e=>Object.fromEntries(Object.entries(d(e)).filter(([t,n])=>p(t)&&n===!0)),V=(e,t)=>k.find(n=>n.kind===e&&n.value===t),q=e=>typeof e=="number"&&Number.isFinite(e)?e:Date.now(),F=(e=Date.now())=>new Date(q(e)+540*60*1e3).toISOString().slice(0,10),A=()=>({version:1,coins:0,totalEarned:0,owned:[...L],equipped:{...T},wish:"open",rewardedRounds:{},firstClears:{},corrections:{},dailyRaceCounts:{},missions:{}}),E=(e,t)=>typeof e=="string"&&e.length<=t?e:"";function $(e,t){return{id:E(t.id,240),date:e,kind:t.kind,target:t.target,collection:t.collection==="words"?"words":"campaign",title:E(t.title,120),description:E(t.description,400),reward:s(t.reward,0,1e3),completed:t.completed===!0,completedAt:s(t.completedAt,0,Number.MAX_SAFE_INTEGER)}}function a(e,t=$){let n=A();if(!e||typeof e!="object")return n;n.coins=s(e.coins),n.totalEarned=Math.max(n.coins,s(e.totalEarned)),n.owned=[...new Set([...L,...(Array.isArray(e.owned)?e.owned:[]).filter(o=>R(o))])];let r=d(e.equipped);for(let o of Object.keys(T)){let i=V(o,r[o]);i&&n.owned.includes(i.id)&&(n.equipped[o]=i.value)}n.wish=y.some(o=>o.id===e.wish&&!o.unlockOnly)?e.wish:e.wish===null?null:"open",n.firstClears=N(e.firstClears),n.corrections=N(e.corrections),n.rewardedRounds=Object.fromEntries(Object.entries(d(e.rewardedRounds)).filter(([o])=>p(o)).map(([o,i])=>[o,{date:/^\d{4}-\d{2}-\d{2}$/.test(i?.date)?i.date:"",coins:s(i?.coins)}])),n.dailyRaceCounts=Object.fromEntries(Object.entries(d(e.dailyRaceCounts)).filter(([o])=>/^\d{4}-\d{2}-\d{2}$/.test(o)).map(([o,i])=>[o,s(i,0,1e6)]));for(let[o,i]of Object.entries(d(e.missions))){if(!/^\d{4}-\d{2}-\d{2}$/.test(o)||!i||typeof i!="object"||!["correction","first-clear"].includes(i.kind)||!p(i.target))continue;let f=t(o,i);f&&(n.missions[o]=f)}return n}function Q(e,t){try{return a(JSON.parse(e.getItem(_)),t)}catch{return A()}}function X(e,t,n){try{return t.setItem(_,JSON.stringify(a(e,n))),!0}catch{return!1}}function Z(e,t){let n=a(e),r=R(t);return r?n.owned.includes(t)?{state:n,ok:!1,reason:"owned"}:r.unlockOnly||r.price===null?{state:n,ok:!1,reason:"unlock-only"}:n.coins<r.price?{state:n,ok:!1,reason:"insufficient"}:(n.coins-=r.price,n.owned.push(t),r.kind==="vehicle"&&n.wish===r.value&&(n.wish=null),{state:n,ok:!0,reason:null}):{state:n,ok:!1,reason:"unknown"}}function v(e,t){let n=a(e),r=R(t);return r?n.owned.includes(t)?(n.equipped[r.kind]=r.value,{state:n,ok:!0,reason:null}):{state:n,ok:!1,reason:"unowned"}:{state:n,ok:!1,reason:"unknown"}}function ee(e,t){let n=a(e),r=y.find(o=>o.id===t&&!o.unlockOnly);return t===null?n.wish=null:r&&(n.wish=n.owned.includes(`vehicle-${t}`)?null:t),n}function ne(e,{game:t,total:n,correct:r,completed:o=!1,automatic:i=!1,now:f=Date.now(),roundId:g}={}){let c=a(e),O=F(f),u=[],m=l=>({state:c,coins:0,breakdown:u,reason:l});if(i)return m("automatic");if(o!==!0||!Number.isInteger(n)||n<1||n>1e4||!Number.isInteger(r)||r<0||r>n)return m("unfinished");if(!D.includes(t)||!p(g))return m("invalid-round");if(Object.hasOwn(c.rewardedRounds,g))return m("duplicate-round");let j=c.dailyRaceCounts[O]||0,S=j<w.dailyRaceLimit;if(S){u.push({id:"finish",label:"\uBBF8\uB2C8\uAC8C\uC784 \uC644\uC8FC",coins:w.finish});let l=Math.round(w.miniGameAccuracy*r/n);l>0&&u.push({id:"correct",label:"\uC815\uB2F5 \uBCF4\uC0C1",coins:l})}c.dailyRaceCounts[O]=j+1;let b=u.reduce((l,z)=>l+z.coins,0);return c.coins=Math.min(1e9,c.coins+b),c.totalEarned=Math.min(1e9,c.totalEarned+b),c.rewardedRounds[g]={date:O,coins:b},{state:c,coins:b,breakdown:u,reason:S?null:"daily-limit"}}return B(te);})();

/* Shared collection adapter. Purchase and reward rules live only in korean-racing/garage-core.js. */
(function (global) {
  'use strict';
  const KEY='SYNK_PLAY_COLLECTION_V1';
  const pathname=global.location?.pathname||'/';
  // Where racing's garage is for this page: inside racing's own package (/play/…), on synk.im (/try/…),
  // or beside the game on a local server or the learning hub (/blank-slice/ → /korean-racing/).
  const nestedPlay=pathname.match(/^(.*)\/play\/(?:rhythm|runner)\//);
  const besideRacing=pathname.match(/^(.*)\/(?:korean-[a-z]+|learning-hub|blank-slice|entry-check|story-classroom|order-rush)\//);
  const racingPath=nestedPlay?nestedPlay[1]+'/':pathname.startsWith('/try/')?'/try/racing/':besideRacing?besideRacing[1]+'/korean-racing/':'/';
  const garageHref=racingPath+'?garage=1';
  function economy(){return Promise.resolve(global.SynkCollectionEconomy);}
  function storage(){try{return global.localStorage;}catch{return null;}}
  async function load(){const store=storage();if(!store)return null;try{store.getItem(KEY);return (await economy()).loadGarage(store);}catch{return null;}}
  async function save(state){const store=storage();if(!store)return false;try{return (await economy()).saveGarage(state,store);}catch{return false;}}
  async function award(round){
    const store=storage();
    if(!store)return {coins:0,reason:'storage-unavailable',saved:false,state:null};
    try{
      const module=await economy(),before=module.loadGarage(store),result=module.awardMiniGame(before,round);
      if(!module.saveGarage(result.state,store))return {...result,coins:0,state:before,reason:'storage-unavailable',saved:false};
      refreshBadges(result.state);
      return {...result,saved:true};
    }catch{return {coins:0,reason:'unavailable',saved:false,state:null};}
  }
  async function equip(itemId){
    const store=storage();if(!store)return {ok:false,reason:'storage-unavailable'};
    try{
      const module=await economy(),result=module.equipItem(module.loadGarage(store),itemId);
      if(result.ok&&!module.saveGarage(result.state,store))return {...result,ok:false,reason:'storage-unavailable'};
      refreshBadges(result.state);return result;
    }catch{return {ok:false,reason:'unavailable'};}
  }
  async function catalog(){try{return (await economy()).SHOP_ITEMS.map(item=>({...item}));}catch{return [];}}
  function roundId(game){return `${game}:${global.crypto?.randomUUID?.()||Date.now()+'-'+Math.random().toString(36).slice(2)}`;}
  // The equipped badge is named in words beside the coins; it is not drawn as an icon.
  async function refreshBadges(state){
    const current=state||await load(),active=current?.owned?.includes('badge-coast')&&current?.equipped?.badge==='coast';
    for(const node of global.document?.querySelectorAll('[data-collection-badge]')||[]){node.hidden=!active;node.textContent='코스트 챔피언';node.setAttribute('aria-label','공통 차고에서 장착한 코스트 챔피언 배지');}
    for(const node of global.document?.querySelectorAll('[data-collection-balance]')||[])node.textContent=current?`보유 ${current.coins}코인`:'코인저장불가';
  }
  function rewardText(result){
    if(result?.saved&&result.coins>0)return `공통 코인 +${result.coins} · 보유 ${result.state.coins}`;
    if(result?.reason==='automatic')return '자동 시연은 공통 코인을 지급하지 않아요.';
    if(result?.reason==='unfinished')return '한 판을 끝까지 마치면 공통 코인이 모여요.';
    if(result?.reason==='daily-limit')return '오늘의 완주 코인 10회분을 모두 받았어요.';
    if(result?.reason==='duplicate-round')return '이번 완주 보상은 이미 차고에 모였어요.';
    if(result?.reason==='storage-unavailable')return '브라우저 저장이 제한되어 코인을 보관하지 못했어요.';
    return '공통 차고를 연결하지 못했어요.';
  }
  function connectLinks(){for(const node of global.document?.querySelectorAll('[data-collection-garage]')||[])node.href=garageHref;}
  const style=global.document?.createElement('style');
  if(style){style.textContent='.synk-collection-line{display:flex;align-items:center;flex-wrap:wrap;gap:8px 18px;font-size:13px;line-height:1.6;margin:14px 0}.synk-collection-line a{color:inherit;text-underline-offset:4px}.synk-collection-badge{font-size:12px;line-height:1.4;white-space:nowrap;opacity:.8}.synk-collection-badge[hidden],.synk-collection-line[hidden]{display:none!important}';global.document.head?.append(style);}
  global.SynkPlayCollection=Object.freeze({key:KEY,load,save,award,equip,catalog,roundId,refreshBadges,rewardText,garageHref});
  // A page may load this before its body is parsed; wire the links once the document is ready.
  if(global.document?.readyState==='loading')global.document.addEventListener?.('DOMContentLoaded',()=>{connectLinks();refreshBadges();});
  connectLinks();refreshBadges();
  global.addEventListener?.('storage',event=>{if(event.key===KEY)refreshBadges();});
  global.addEventListener?.('pageshow',()=>refreshBadges());
})(globalThis);
