/* Game-owned goals and collections; transactions stay in the canonical collection ledger. */
(function(global){
  'use strict';
  const names={racing:'한국어 레이싱',rhythm:'말의 리듬',runner:'바람길','order-rush':'주문 폭주','entry-check':'입장 검사','story-classroom':'선생님이 돌아왔다','blank-slice':'빈칸 베기'};
  const subtitles={racing:'달려온 길을 나만의 컬렉션으로',rhythm:'다음 곡은 나의 무대에서',runner:'한 번의 여행마다 남는 작은 빛','order-rush':'한 잔씩, 나만의 카페로','entry-check':'당신의 도장이 쌓이는 곳','story-classroom':'읽고 해낸 이야기를 모아요','blank-slice':'칼끝에 나만의 색을 더해요'};
  const pictures={racing:'medal',rhythm:'headphones',runner:'lantern','order-rush':'coffee','entry-check':'stamp','story-classroom':'notebook','blank-slice':'sparkle'};
  const script=global.document?.currentScript?.src;
  const asset=name=>new URL('assets/progress/'+name+'.webp',script||global.document.baseURI).href;
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const node=value=>typeof value==='string'?document.querySelector(value):value;
  let serial=0;
  function mount(options={}){
    const api=global.SynkPlayCollection,game=options.game,home=node(options.home),result=node(options.result);
    if(!api?.progress||!names[game]||(!home&&!result))return null;
    const id='play-collection-'+(++serial),dialog=document.createElement('dialog');
    dialog.id=id;dialog.className='play-collection-dialog';dialog.setAttribute('aria-labelledby',id+'-title');
    document.body.append(dialog);
    let state=null,tab='shop',selected=null,busy=false,revision=0,lastEquipment='',reward=null,notice='',returnFocus=null,returnTarget=null,returnTab=null;
    function image(name,className=''){return '<img class="'+className+'" src="'+escape(asset(name))+'" alt="" loading="lazy">';}
    function titleItem(){return state?.items?.find(item=>item.slot==='title'&&(item.equipped||item.value===state.equipment?.title));}
    function titleText(){return titleItem()?.name||'아직 고르지 않은 칭호';}
    function next(){return state?.nextAchievement||state?.achievements?.find(a=>!a.unlocked);}
    function bar(current,target,label){return '<progress max="'+Math.max(1,target||1)+'" value="'+Math.min(current||0,target||1)+'" aria-label="'+escape(label)+'"></progress>';}
    function goalLine(){const goal=next();return goal?'<strong>'+escape(goal.name)+'</strong><span>'+escape(goal.description)+'</span>'+bar(goal.current,goal.target,goal.name)+'<small>'+goal.current+' / '+goal.target+'</small>':'<strong>이 게임의 업적을 모두 모았어요.</strong><span>모은 칭호에서 오늘의 이름을 골라요.</span>';}
    function drawStrip(target,isResult=false){
      if(!target)return;
      const earned=reward?.saved!==false?reward?.newAchievements||[]:[];
      const wish=state?.wish;
      target.classList.add('play-progress-slot');
      target.innerHTML='<section class="play-journey-strip" aria-label="'+escape(names[game])+' 목표와 꾸미기">'+image(isResult&&earned.length?'medal':pictures[game],'play-journey-art')+'<div class="play-journey-copy"><span class="play-small-label">'+(isResult&&earned.length?'새로운 칭호를 얻었어요':'다음으로 남길 기록')+'</span>'+(isResult&&earned.length?'<strong class="play-earned-name">'+escape(earned.map(a=>(state.items||[]).find(i=>i.id===a.rewardId)?.name||a.name).join(' · '))+'</strong>':'')+goalLine()+(titleItem()?'<span class="play-equipped-caption">나의 칭호 · '+escape(titleItem().name)+'</span>':'')+'</div><div class="play-journey-actions"><button type="button" class="play-felt-button" data-progress-open="shop">'+(options.nativeShop?'상점 · 내 목표':'나의 상점')+'</button><button type="button" class="play-paper-button" data-progress-open="achievements">업적 · 칭호</button></div>'+(wish?'<p class="play-wish-line">갖고 싶은 '+escape(wish.name)+' · '+(state.coins>=wish.price?'지금 살 수 있어요':Math.max(0,wish.price-state.coins)+'코인 더 모으면 돼요')+'</p>':'')+'</section>';
      for(const button of target.querySelectorAll('[data-progress-open]'))button.onclick=()=>open(button.dataset.progressOpen);
    }
    function itemArt(item){return image(item.slot==='title'?'medal':pictures[game],'play-item-art')+(item.slot==='style'&&item.value!=='default'?'<span class="play-style-sample play-style-'+escape(item.value)+'" aria-hidden="true"></span>':'');}
    function renderShop(){
      const items=(state.items||[]).filter(i=>i.slot!=='title');
      const paid=items.filter(i=>i.price>0);
      if(!paid.length&&options.nativeShop)return '<div class="play-native-shop">'+image(pictures[game],'play-native-art')+'<div><span class="play-small-label">이미 모은 꾸미기를 그대로</span><h3>'+escape(options.nativeShopLabel||'나의 상점')+'</h3><p>'+escape(options.nativeShopDescription||'구매한 물건을 살펴보고, 다음에 갖고 싶은 것을 골라요.')+'</p><button class="play-felt-button" type="button" data-native-shop>상점에서 골라보기 →</button></div></div>';
      if(!items.length)return '<p>이 게임의 꾸미기를 준비하지 못했어요. 다시 열어 주세요.</p>';
      if(!items.some(i=>i.id===selected))selected=state.wish?.id||paid.find(i=>!i.owned)?.id||items.find(i=>i.equipped)?.id||items[0].id;
      const item=items.find(i=>i.id===selected)||items[0],missing=Math.max(0,(item.price||0)-state.coins);
      return '<p class="play-shop-intro">플레이하며 모은 코인으로 골라요. 꾸미기는 정답이나 판정에 영향을 주지 않아요.</p><div class="play-shop-layout"><div class="play-shop-items">'+items.map(i=>'<button type="button" class="play-shop-card" data-select-item="'+escape(i.id)+'" aria-pressed="'+(i.id===item.id)+'">'+itemArt(i)+'<strong>'+escape(i.name)+'</strong><span>'+escape(i.equipped?'장착 중':i.owned?'보유 중':i.price===0?'기본 꾸미기':i.price+'코인')+'</span></button>').join('')+'</div><section class="play-item-detail" aria-label="선택한 꾸미기"><div class="play-item-hero">'+itemArt(item)+'</div><span class="play-small-label">'+escape(item.owned?'나의 컬렉션':'다음에 갖고 싶은 것')+'</span><h3>'+escape(item.name)+'</h3><p>'+escape(item.description)+'</p><strong class="play-price">'+escape(item.owned?'보유 중':item.price+'코인')+'</strong><button type="button" class="play-felt-button" data-item-action="'+escape(item.id)+'" '+(busy||item.equipped||!state.available||(!item.owned&&missing>0)?'disabled':'')+'>'+(item.equipped?'지금 장착 중':item.owned?'장착하기':missing?'코인 '+missing+'개 더 모아요':item.price+'코인으로 구매')+'</button>'+(!item.owned?'<button type="button" class="play-paper-button" data-wish="'+escape(item.id)+'" aria-pressed="'+(state.wish?.id===item.id)+'" '+(!state.available?'disabled':'')+'>'+(state.wish?.id===item.id?'목표로 골랐어요 · 해제':'다음 목표로 고르기')+'</button>':'')+'</section></div>';
    }
    function renderAchievements(){return '<p class="play-shop-intro">달성하면 칭호가 열려요. 코인을 쓰지 않고 장착할 수 있어요.</p><div class="play-achievements">'+(state.achievements||[]).map(a=>{const item=state.items.find(i=>i.id===a.rewardId);return '<article class="play-achievement '+(a.unlocked?'is-earned':'')+'">'+image('medal','play-achievement-art')+'<div><span class="play-small-label">'+(a.unlocked?'달성한 기록':'도전 중')+'</span><h3>'+escape(a.name)+'</h3><p>'+escape(a.description)+'</p>'+bar(a.current,a.target,a.name)+'<span class="play-achievement-count">'+a.current+' / '+a.target+'</span><div class="play-title-reward">칭호 <strong>'+escape(item?.name||a.name)+'</strong></div>'+(a.unlocked?'<button type="button" class="play-felt-button" data-equip-title="'+escape(a.rewardId)+'" '+(item?.equipped||busy||!state.available?'disabled':'')+'>'+(item?.equipped?'장착 중':'이 칭호 달기')+'</button>':'<span class="play-unlock-note">달성하면 받을 수 있어요</span>')+'</div></article>';}).join('')+'</div>';}
    function renderTitles(){
      const all=(state.items||[]).filter(i=>i.slot==='title'),owned=all.filter(i=>i.owned);
      return '<div class="play-title-showcase">'+image('medal','play-title-medal')+'<span class="play-small-label">'+escape(names[game])+'에서 쓰는 나의 이름</span><h3>'+escape(titleText())+'</h3><p>게임 화면과 다음 결과에 함께 표시돼요.</p></div><div class="play-title-list">'+(owned.length?owned.map(i=>'<button type="button" class="play-title-choice" data-equip-title="'+escape(i.id)+'" aria-pressed="'+!!i.equipped+'" '+(busy||!state.available?'disabled':'')+'>'+image(i.equipped?'check':'medal')+'<span>'+escape(i.name)+'</span><small>'+(i.equipped?'장착 중':'장착하기')+'</small></button>').join(''):'<div class="play-empty"><strong>첫 번째 칭호가 기다리고 있어요.</strong><p>한 판을 끝까지 마치면 이 게임의 첫 칭호를 받을 수 있어요.</p><button type="button" class="play-felt-button" data-switch-tab="achievements">업적 살펴보기 →</button></div>')+'</div>';
    }
    function renderDialog(){
      if(!dialog.open||!state)return;
      const active=document.activeElement,scrollTop=dialog.scrollTop,focusKey=['selectItem','itemAction','equipTitle','wish','switchTab'].find(key=>active?.dataset?.[key]),focusValue=focusKey?active.dataset[focusKey]:null;
      dialog.innerHTML='<div class="play-collection-sheet"><header class="play-collection-header"><div><span class="play-small-label">MY LITTLE COLLECTION</span><h2 id="'+id+'-title">'+escape(names[game])+' · 나의 기록</h2><p>'+escape(subtitles[game])+'</p></div><div class="play-collection-tools"><span class="play-wallet">'+image('coin')+'<strong>'+state.coins+'</strong> 코인</span><button type="button" class="play-dialog-close" aria-label="상점과 업적 닫기">×</button></div></header><nav class="play-collection-tabs" aria-label="컬렉션 메뉴">'+[['shop','상점'],['achievements','업적'],['titles','나의 칭호']].map(([key,label])=>'<button type="button" data-switch-tab="'+key+'" aria-pressed="'+(tab===key)+'">'+label+'</button>').join('')+'</nav><div class="play-collection-content">'+(tab==='shop'?renderShop():tab==='achievements'?renderAchievements():renderTitles())+'</div><p class="play-collection-notice" role="status" aria-live="polite">'+escape(!state.available?'브라우저 저장을 사용할 수 없어 구매와 장착을 할 수 없어요.':notice)+'</p><footer class="play-collection-footer"><span>'+(global.SynkPlayAccount?.status().mode==='account'?'내 SYNK 계정의 컬렉션':'로그인 전 브라우저 체험 컬렉션')+'</span><span>하루 완주 코인 10회 · 업적은 계속 쌓여요</span></footer></div>';
      dialog.querySelector('.play-dialog-close').onclick=close;
      for(const button of dialog.querySelectorAll('[data-switch-tab]'))button.onclick=()=>{tab=button.dataset.switchTab;notice='';dialog.scrollTop=0;renderDialog();dialog.querySelector('[data-switch-tab="'+tab+'"]').focus();};
      for(const button of dialog.querySelectorAll('[data-select-item]'))button.onclick=()=>{selected=button.dataset.selectItem;notice='';renderDialog();dialog.querySelector('[data-select-item="'+selected+'"]').focus();};
      for(const button of dialog.querySelectorAll('[data-item-action],[data-equip-title]'))button.onclick=()=>transact(button.dataset.itemAction||button.dataset.equipTitle);
      for(const button of dialog.querySelectorAll('[data-wish]'))button.onclick=()=>wish(button.dataset.wish);
      const native=dialog.querySelector('[data-native-shop]');if(native)native.onclick=()=>{close();options.nativeShop();};
      if(focusKey){const attr=focusKey.replace(/[A-Z]/g,c=>'-'+c.toLowerCase()),candidate=dialog.querySelector('[data-'+attr+'="'+focusValue+'"]');(candidate&&!candidate.disabled?candidate:dialog.querySelector('[data-select-item="'+selected+'"]')||dialog.querySelector('[data-switch-tab="'+tab+'"]'))?.focus();}dialog.scrollTop=scrollTop;
    }
    async function refresh(){
      const mine=++revision;
      try{const value=await api.progress(game);if(mine!==revision||!value)return;state=value;
        const signature=JSON.stringify(state.equipment);if(signature!==lastEquipment){lastEquipment=signature;options.onEquip?.({...state.equipment});}
        const title=titleItem();for(const el of document.querySelectorAll('[data-play-title]')){if(el.dataset.playTitle&&el.dataset.playTitle!==game)continue;el.textContent=title?.name||'';el.hidden=!title;}
        drawStrip(home);drawStrip(result,true);renderDialog();
      }catch{if(home)home.textContent='컬렉션을 불러오지 못했어요. 게임은 계속할 수 있어요.';}
    }
    function message(reason){return ({'insufficient':'코인이 조금 더 필요해요. 다음 목표로 골라 보세요.','insufficient-coins':'코인이 조금 더 필요해요.','storage-unavailable':'저장하지 못해 구매·장착을 완료하지 않았어요.','unowned':'먼저 이 물건을 모아 주세요.','unlock-only':'업적을 달성하면 받을 수 있어요.'})[reason]||'변경하지 못했어요. 다시 시도해 주세요.';}
    async function transact(itemId){
      if(busy||!state?.available)return;const item=state.items.find(i=>i.id===itemId);if(!item)return;
      busy=true;notice='';renderDialog();
      try{
        const out=item.owned?await api.equip(itemId):await api.buy(itemId);
        if(!out.ok){notice=message(out.reason);return;}
        if(!item.owned){const equipped=await api.equip(itemId);notice=equipped.ok?item.name+' 구매 완료 · 지금 장착했어요.':item.name+'을 보관했어요. 장착은 다시 시도해 주세요.';}
        else notice=item.name+'을 장착했어요.';
      }catch{notice='저장 연결을 확인해 주세요.';}finally{busy=false;await refresh();}
    }
    async function wish(itemId){if(busy||!state?.available)return;busy=true;try{const clear=state.wish?.id===itemId;const out=await api.setGoal(game,clear?null:itemId);notice=out.ok?(clear?'다음 목표를 해제했어요.':'로비에서 모으는 과정을 볼 수 있어요.'):message(out.reason);}finally{busy=false;await refresh();}}
    async function open(which='shop'){
      tab=['shop','achievements','titles'].includes(which)?which:'shop';notice='';returnFocus=document.activeElement;returnTarget=home?.contains(returnFocus)?home:result?.contains(returnFocus)?result:null;returnTab=returnFocus?.dataset?.progressOpen;
      await refresh();if(!state)return;if(!dialog.open)dialog.showModal();renderDialog();dialog.querySelector('.play-dialog-close')?.focus();options.onOpen?.();
    }
    function close(){if(dialog.open)dialog.close();const focus=returnFocus?.isConnected?returnFocus:returnTarget?.querySelector('[data-progress-open="'+returnTab+'"]');focus?.focus?.();options.onClose?.();}
    dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
    dialog.addEventListener('click',e=>{if(e.target===dialog)close();});
    const blockKeys=e=>{if(!dialog.open)return;if(e.key==='Escape'){e.preventDefault();close();}e.stopImmediatePropagation();};
    global.addEventListener('keydown',blockKeys,true);global.addEventListener('keyup',blockKeys,true);
    const changed=()=>refresh();global.addEventListener('synk:collection-change',changed);global.addEventListener('pageshow',changed);
    void refresh();
    return {refresh,open,close,showRewards(value){reward=value;return refresh();},get info(){return {game,open:dialog.open,tab,state};},dispose(){global.removeEventListener('keydown',blockKeys,true);global.removeEventListener('keyup',blockKeys,true);global.removeEventListener('synk:collection-change',changed);global.removeEventListener('pageshow',changed);dialog.remove();}};
  }
  global.SynkPlayProgress=Object.freeze({mount,names});
})(globalThis);
