/* Shared collection adapter. Purchase and reward rules live only in korean-racing/garage-core.js. */
(function (global) {
  'use strict';
  const KEY='SYNK_PLAY_COLLECTION_V1';
  const pathname=global.location?.pathname||'/';
  // Where racing's garage is for this page: inside racing's own package (/play/…), on synk.im (/try/…),
  // or beside the game on a local server or the learning hub (/blank-slice/ → /korean-racing/).
  const nestedPlay=pathname.match(/^(.*)\/play\/(?:rhythm|runner)\//);
  const besideRacing=pathname.match(/^(.*)\/(?:korean-[a-z]+|learning-hub|blank-slice|entry-check|story-classroom|order-rush|talk-rally|word-magic|spaceship-coop)\//);
  const racingPath=nestedPlay?nestedPlay[1]+'/':pathname.startsWith('/try/')?'/try/racing/':besideRacing?besideRacing[1]+'/korean-racing/':'/';
  const garageHref=racingPath+'?garage=1';
  function economy(){return Promise.resolve(global.SynkCollectionEconomy);}
  function storage(){try{return global.SynkPlayAccount?.storage()||global.localStorage;}catch{return null;}}
  const ready=()=>global.SynkPlayAccount?.ready()||Promise.resolve();
  const account=()=>global.SynkPlayAccount?.status().mode==='account';
  // Tabs on the same origin must read the latest wallet inside the same transaction.
  // Older browsers fall back to a synchronous read/write section after economy is ready.
  function transaction(task){return global.navigator?.locks?.request?global.navigator.locks.request(KEY,task):task();}
  async function load(){try{await ready();const store=storage();if(!store)return null;store.getItem(KEY);return (await economy()).loadGarage(store);}catch{return null;}}
  function changed(state){
    refreshBadges(state);
    if(typeof global.CustomEvent==='function')global.dispatchEvent?.(new global.CustomEvent('synk:collection-change',{detail:{state}}));
  }
  async function save(state){await ready();if(account())return false;const store=storage();if(!store)return false;try{const module=await economy(),next=module.normalizeGarage(state);if(!module.saveGarage(next,store))return false;changed(next);return true;}catch{return false;}}
  const award=round=>transaction(()=>awardUnlocked(round));
  const awardPractice=round=>transaction(()=>awardUnlocked(round,'awardBeginnerPractice'));
  async function awardUnlocked(round,method='awardMiniGame'){
    try{await ready();if(account()){const result=await global.SynkPlayAccount.wallet(method,[round]);changed(result.state);return result;}}catch{return {coins:0,reason:'account-pending',saved:false,state:await load(),breakdown:[],newAchievements:[]};}
    const store=storage();
    if(!store)return {coins:0,reason:'storage-unavailable',saved:false,state:null};
    try{store.getItem(KEY);}catch{return {coins:0,reason:'storage-unavailable',saved:false,state:null};}
    try{
      const module=await economy(),before=module.loadGarage(store),result=module[method](before,round);
      if(!module.saveGarage(result.state,store))return {...result,coins:0,newAchievements:[],state:before,reason:'storage-unavailable',saved:false};
      if(!['automatic','unfinished','invalid-round','duplicate-round'].includes(result.reason))changed(result.state);
      return {...result,saved:true};
    }catch{return {coins:0,reason:'unavailable',saved:false,state:null};}
  }
  const mutate=(method,...args)=>transaction(()=>mutateUnlocked(method,...args));
  async function mutateUnlocked(method,...args){
    try{await ready();if(account()){const result=await global.SynkPlayAccount.wallet(method,args);changed(result.state);return result;}}catch{return {ok:false,reason:'account-pending',state:await load()};}
    const store=storage();if(!store)return {ok:false,reason:'storage-unavailable'};
    try{store.getItem(KEY);}catch{return {ok:false,reason:'storage-unavailable'};}
    try{
      const module=await economy(),before=module.loadGarage(store),result=module[method](before,...args);
      if(result.ok&&!module.saveGarage(result.state,store))return {...result,state:before,ok:false,reason:'storage-unavailable'};
      if(result.ok)changed(result.state);return result;
    }catch{return {ok:false,reason:'unavailable'};}
  }
  const buy=itemId=>mutate('buyItem',itemId);
  const equip=itemId=>mutate('equipItem',itemId);
  const setGoal=(game,itemId)=>mutate('setGameGoal',game,itemId);
  const setBeginnerGoal=(game,itemId)=>mutate('setBeginnerGoal',game,itemId);
  async function beginnerProgress(game){
    try{const module=await economy(),state=await load(),result=module.beginnerProgress(state||module.emptyGarage(),game);return {...result,available:result.available&&state!==null};}
    catch{return {game,available:false,coins:0,items:[],goal:null,remaining:0,affordable:false,owned:false,practiceClaimed:false};}
  }
  // Guidance only: completion and coin payment still use the canonical economy.
  // Read the restored account snapshot, never a second browser-only progress store.
  async function beginnerRewardRoute(game){
    const base=pathname.startsWith('/try/')?'/try':besideRacing?besideRacing[1]:'';
    const gamePath=(slug,leaf='')=>`${base}/${slug}/${leaf}`;
    const hub=gamePath('learning-hub','#beginner-title');
    const closed=(reason,description,descriptionEn)=>({available:false,reason,href:hub,label:'무료 학습 계속하기',labelEn:'Keep learning for free',description,descriptionEn,potentialCoins:0,kind:null});
    if(!['word-magic','order-rush','spaceship-coop'].includes(game))return {...closed('unknown-game','이 게임의 입문 학습 경로를 찾지 못했어요.','No beginner route is available for this game.'),href:null};
    try{
      await ready();const bridge=global.SynkPlayAccount,status=bridge?.status?.();
      if(status?.mode==='account'&&['loading','offline','conflict','stopped'].includes(status.phase))return closed('storage-unavailable','계정 저장 상태를 확인한 뒤 보상 안내를 다시 불러와 주세요. 학습은 무료예요.','Check the account save status before reloading reward guidance. Learning stays free.');
      const store=bridge?.storage?bridge.storage():storage(),module=await economy(),wallet=store?await load():null;
      if(!store||!wallet)return closed('storage-unavailable','저장 연결을 확인한 뒤 보상 경로를 다시 불러와 주세요. 학습은 무료예요.','Check the save connection and reload reward guidance. Learning stays free.');
      const date=module.seoulDate(),claimed=id=>Object.hasOwn(wallet.rewardedRounds,id);
      if((wallet.dailyRaceCounts[date]||0)>=module.REWARDS.dailyRaceLimit)return closed('daily-limit','오늘의 공통 보상 10회분을 모두 받았어요. 지금은 코인 없이 편하게 놀고, 내일 다시 모을 수 있어요.','You have received all 10 shared rewards today. Play freely now; rewards return tomorrow.');
      // Guidance must not advance the playing game's observed CAS base.
      const read=key=>{if(status?.mode==='account'&&!bridge.readRecord)throw Error('read-only-record-unavailable');const raw=bridge?.readRecord?bridge.readRecord(key):store.getItem(key);if(!raw)return null;try{return JSON.parse(raw);}catch{return null;}};
      const magic=read('synk.word-magic.progress.v1'),order=read('synk.order-rush.beginner.v1');
      const chapters=['size','doors','sky'];
      const completed=new Set(magic?.version===1&&Array.isArray(magic.completed)?magic.completed:[]);
      let unlocked=2;for(let i=0;i<3;i++){if(Array.from({length:6},(_,n)=>`${chapters[i]}-${n+1}`).some(id=>!completed.has(id))){unlocked=i;break;}}
      const chapterIndex=chapters.findIndex((id,i)=>i<=unlocked&&!claimed(`word-magic:chapter:${id}`));
      const chapter=chapterIndex<0?null:{available:true,reason:null,href:gamePath('word-magic',`?chapter=${chapterIndex}`),label:`마법 모험 ${chapterIndex+1}장 이어하기`,labelEn:`Continue magic chapter ${chapterIndex+1}`,description:'이 장의 사건 6개와 소리 확인 2개를 마치면 첫 완주 보상 15코인을 받을 수 있어요. 도움은 언제든 사용할 수 있어요.',descriptionEn:'Finish six discoveries and two sound checks for this chapter’s first 15-coin reward. Help is always free.',potentialCoins:15,kind:'magic-chapter',chapterIndex};
      const introduced=magic?.version===1&&Array.isArray(magic.introduced)&&magic.introduced.some(id=>chapters.includes(id));
      const practice=introduced&&!claimed(`beginner-practice:word-magic:${date}`)?{available:true,reason:null,href:gamePath('word-magic','?play=lab'),label:'배운 말로 실험하기 · 오늘 +5',labelEn:'Play with familiar words · today +5',description:'소리를 듣고 두 말·두 물건으로 서로 다른 변화 3번을 만들어요. 오늘 한 번 5코인을 받을 수 있어요.',descriptionEn:'Listen and make three different changes using two words and two objects for today’s one-time 5-coin reward.',potentialCoins:5,kind:'magic-practice'}:null;
      const validOrder=order?.version===1&&Number.isInteger(order.seed)&&order.seed>=1&&order.seed<=1e12;
      const finished=validOrder&&Array.isArray(order.completed)&&[0,1,2,3].every(i=>order.completed.includes(i));
      const orderId=validOrder&&module.safeKey(order.roundId)&&order.roundId.length<180?order.roundId:null;
      const voiceId=/^(?:water|bread|apple)(?:-please)?$|^(?:bread|apple)-[123]$|^count-[123]$/;
      const orderReady=!finished||(orderId&&Array.isArray(order.records)&&order.records.filter(r=>r&&!r.demo&&Number.isInteger(r.stage)&&r.stage>=0&&r.stage<4&&typeof r.voice==='string'&&voiceId.test(r.voice)).slice(0,300).length===27);
      const story=orderReady&&(!orderId||!claimed(orderId))?{available:true,reason:null,href:gamePath('order-rush','beginner.html'),label:finished?'첫 영업 보상 다시 연결하기':'우리 가게 첫 영업 이어하기',labelEn:finished?'Retry the first-shop reward':'Continue my first shop',description:'첫 영업의 네 장을 끝까지 마치면 15~25코인을 한 번 받아요. 주문을 다시 듣거나 도움을 써도 기본 완주 보상은 받을 수 있어요.',descriptionEn:'Finish the four first-shop chapters for a one-time 15–25-coin reward. Replays and help keep the base completion reward available.',potentialCoins:25,kind:'first-shop'}:null;
      return (game==='order-rush'?story||chapter||practice:chapter||practice||story)||closed('no-route','입문 모험의 완주 보상과 오늘의 실험 보상을 모두 받았어요. 복습과 자유 놀이는 계속 무료예요.','You have collected the beginner adventure rewards and today’s experiment reward. Review and free play stay free.');
    }catch{return closed('storage-unavailable','저장 연결을 확인한 뒤 보상 경로를 다시 불러와 주세요. 학습은 무료예요.','Check the save connection and reload reward guidance. Learning stays free.');}
  }
  async function catalog(game){try{return (await economy()).SHOP_ITEMS.filter(item=>game===undefined||item.game===game).map(item=>({...item}));}catch{return [];}}
  async function progress(game){
    try{const module=await economy(),state=await load(),result=module.gameProgress(state||module.emptyGarage(),game);return {...result,available:result.available&&state!==null};}
    catch{return {game,available:false,coins:0,stats:null,equipment:null,items:[],achievements:[],wish:null,nextAchievement:null};}
  }
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
    if(result?.reason==='daily-limit')return '오늘의 공통 코인 보상 10회분을 모두 받았어요.';
    if(result?.reason==='duplicate-round')return '이번 완주 보상은 이미 받았어요.';
    if(result?.reason==='storage-unavailable')return '브라우저 저장이 제한되어 코인을 보관하지 못했어요.';
    if(result?.reason==='account-pending')return '계정 저장을 기다리고 있어요. 연결을 확인한 뒤 저장을 다시 시도해 주세요.';
    return '코인 저장을 연결하지 못했어요.';
  }
  function connectLinks(){for(const node of global.document?.querySelectorAll('[data-collection-garage]')||[])node.href=garageHref;}
  const style=global.document?.createElement('style');
  if(style){style.textContent='.synk-collection-line{display:flex;align-items:center;flex-wrap:wrap;gap:8px 18px;font-size:13px;line-height:1.6;margin:14px 0}.synk-collection-line a{color:inherit;text-underline-offset:4px}.synk-collection-badge{font-size:12px;line-height:1.4;white-space:nowrap;opacity:.8}.synk-collection-badge[hidden],.synk-collection-line[hidden]{display:none!important}';global.document.head?.append(style);}
  global.SynkPlayCollection=Object.freeze({key:KEY,load,save,award,awardPractice,buy,equip,setGoal,setBeginnerGoal,progress,beginnerProgress,beginnerRewardRoute,catalog,roundId,refreshBadges,rewardText,garageHref,command:mutate});
  // A page may load this before its body is parsed; wire the links once the document is ready.
  if(global.document?.readyState==='loading')global.document.addEventListener?.('DOMContentLoaded',()=>{connectLinks();refreshBadges();});
  connectLinks();refreshBadges();
  global.addEventListener?.('storage',event=>{if(event.key===KEY)load().then(state=>{if(state)changed(state);});});
  global.addEventListener?.('pageshow',()=>refreshBadges());
  global.addEventListener?.('synk:play-account-change',()=>{load().then(state=>{if(state)changed(state);});});
})(globalThis);
