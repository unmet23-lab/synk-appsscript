/* Shared collection adapter. Purchase and reward rules live only in korean-racing/garage.js. */
(function (global) {
  'use strict';
  const KEY='SYNK_PLAY_COLLECTION_V1';
  const pathname=global.location?.pathname||'/';
  const nestedPlay=pathname.match(/^(.*)\/play\/(?:rhythm|runner)\//);
  const racingPath=nestedPlay?nestedPlay[1]+'/':pathname.startsWith('/try/')?'/try/racing/':pathname.startsWith('/korean-')||pathname.startsWith('/learning-hub/')?'/korean-racing/':'/';
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
  async function refreshBadges(state){
    const current=state||await load(),active=current?.owned?.includes('badge-coast')&&current?.equipped?.badge==='coast';
    for(const node of global.document?.querySelectorAll('[data-collection-badge]')||[]){node.hidden=!active;node.setAttribute('aria-label','공통 차고에서 장착한 코스트 챔피언 배지');}
    for(const node of global.document?.querySelectorAll('[data-collection-balance]')||[])node.textContent=current?`보유 ${current.coins}코인`:'코인저장불가';
  }
  function rewardText(result){
    if(result?.saved&&result.coins>0)return `공통 코인 +${result.coins} · 보유 ${result.state.coins}`;
    if(result?.reason==='automatic')return '자동 시연은 공통 코인을 지급하지 않아요.';
    if(result?.reason==='unfinished')return '90초 등불 여행을 완주하면 공통 코인이 모여요.';
    if(result?.reason==='daily-limit')return '오늘의 완주 코인 10회분을 모두 받았어요.';
    if(result?.reason==='duplicate-round')return '이번 완주 보상은 이미 차고에 모였어요.';
    if(result?.saved&&result.coins===0&&result.reason===null)return '오늘의 완주 코인 10회분을 모두 받았어요.';
    if(result?.reason==='storage-unavailable')return '브라우저 저장이 제한되어 코인을 보관하지 못했어요.';
    return '공통 차고를 연결하지 못했어요.';
  }
  function connectLinks(){for(const node of global.document?.querySelectorAll('[data-collection-garage]')||[])node.href=garageHref;}
  const style=global.document?.createElement('style');
  if(style){style.textContent='.synk-collection-line{display:flex;align-items:center;flex-wrap:wrap;gap:8px 18px;font-size:13px;line-height:1.6;margin:14px 0}.synk-collection-line a{color:inherit;text-underline-offset:4px}.synk-collection-badge{font-size:15px;line-height:1;white-space:nowrap}.synk-collection-badge[hidden]{display:none!important}';global.document.head.append(style);}
  global.SynkPlayCollection=Object.freeze({key:KEY,load,save,award,equip,catalog,roundId,refreshBadges,rewardText,garageHref});
  connectLinks();refreshBadges();
  global.addEventListener?.('storage',event=>{if(event.key===KEY)refreshBadges();});
  global.addEventListener?.('pageshow',()=>refreshBadges());
})(globalThis);
