import {SHOP_ITEMS,VEHICLES,FINALE_REWARDS,emptyGarage,buyItem,equipItem,setWish,dailyMission} from './garage.js';

const CATEGORIES=[
  {id:'vehicle',name:'차량'},{id:'paint',name:'도색'},{id:'wheels',name:'휠'},
  {id:'trail',name:'부스터'},{id:'badge',name:'배지'}
];
const REWARD_CHAPTER=Object.fromEntries(Object.entries(FINALE_REWARDS).map(([chapter,id])=>[id,chapter]));
const findItem=id=>SHOP_ITEMS.find(item=>item.id===id);
const equippedItem=(garage,kind)=>SHOP_ITEMS.find(item=>item.kind===kind&&item.value===garage.equipped?.[kind]);
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const coins=value=>Math.max(0,Number(value)||0).toLocaleString('ko-KR');

function itemArt(item){
  const color=item.color||'#c9ced3';
  if(item.kind==='paint')return `<span class="garage-art garage-paint" aria-hidden="true"><img src="assets/felt/badge-cream.webp" alt=""><svg viewBox="0 0 48 48"><path d="M24 8C21 15 12 23 12 30a12 12 0 0 0 24 0C36 23 27 15 24 8Z" fill="${escape(color)}" stroke="#31463e" stroke-width="1.3"/><path d="M17 31c0 4 3 6 6 6" fill="none" stroke="#ffffff9e" stroke-width="2" stroke-linecap="round"/></svg></span>`;
  if(item.kind==='wheels')return `<span class="garage-art garage-wheel" aria-hidden="true"><img src="assets/felt/badge-cream.webp" alt=""><svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="16" fill="#2b3935"/><circle cx="24" cy="24" r="11" fill="${escape(color)}"/><path d="M24 13v22M13 24h22m-19-8 16 16m0-16L16 32" stroke="#56635c" stroke-width="2.5"/><circle cx="24" cy="24" r="4" fill="${escape(color)}"/></svg></span>`;
  if(item.kind==='trail')return `<span class="garage-art garage-trail" aria-hidden="true"><img src="assets/felt/badge-cream.webp" alt=""><svg viewBox="0 0 48 48"><path d="m27 7-14 20h11l-4 14 15-22H25Z" fill="${escape(color)}" stroke="#31463e" stroke-width="1.3" stroke-linejoin="round"/></svg></span>`;
  if(item.kind==='badge')return '<span class="garage-art garage-badge" aria-hidden="true"><img src="assets/felt/badge-check.webp" alt=""></span>';
  const vehicle=VEHICLES.find(v=>v.id===item.value),rally=vehicle?.kind==='rally',open=vehicle?.kind==='open';
  return `<span class="garage-art garage-car" style="--item-color:${escape(color)}"><svg viewBox="0 0 140 62" aria-hidden="true"><path d="${rally?'M16 39 23 26 38 24 51 12 84 12 99 25 117 29 125 39 125 47 15 47Z':open?'M13 39 25 30 48 27 59 16 64 17 61 28 97 28 107 32 123 38 126 46 12 46Z':'M13 39 24 30 44 27 58 14 86 15 105 29 120 36 126 46 12 46Z'}" fill="var(--item-color)"/><path d="${rally?'M43 24 54 15 66 15 66 25Z M71 15 82 15 94 25 71 25Z':open?'M48 27 59 18 60 27Z':'M49 26 60 17 71 17 72 27Z M77 17 84 18 98 28 78 27Z'}" fill="#223638"/><path d="M18 40h8m89 0h7" stroke="#f8edce" stroke-width="3"/><circle cx="36" cy="46" r="10" fill="#1a282a"/><circle cx="103" cy="46" r="10" fill="#1a282a"/><circle cx="36" cy="46" r="5" fill="#c9ced3"/><circle cx="103" cy="46" r="5" fill="#c9ced3"/></svg></span>`;
}

export function createGarageUI({onPreview=()=>{},onEquip=()=>{},onClose=()=>{},onMission=()=>{},readProgress=()=>({}),readGarage=emptyGarage,writeGarage=()=>false}={}){
  const panel=document.getElementById('garage-panel');
  if(!panel)throw new Error('createGarageUI needs #garage-panel');
  let category='vehicle',selectedId='vehicle-coast',opened=false,returnFocus=null,message='',messageKind='info';
  panel.classList.add('garage-panel');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','garage-title');panel.tabIndex=-1;
  panel.innerHTML=`
    <header class="garage-header"><div><span class="garage-eyebrow">MY GARAGE</span><h2 id="garage-title">나의 차고.</h2></div><div class="garage-header-tools"><span class="garage-balance" aria-label="보유 코인"><i aria-hidden="true">C</i><strong id="garage-coins">0</strong><span>코인</span></span><button id="garage-close" type="button" class="garage-close" aria-label="차고 닫기">×</button></div></header>
    <div id="garage-preview" class="garage-preview" aria-label="차량 3D 미리보기"><div class="garage-preview-title"><span class="garage-eyebrow" id="garage-preview-tag">장착 차량</span><h3 id="garage-preview-name">코스트 GT</h3><span class="garage-preview-copy" id="garage-preview-copy">함께 달릴 친구를 태워보세요.</span></div><div class="garage-rotation"><span aria-hidden="true">↶</span><label for="garage-angle">차량 돌려보기</label><input id="garage-angle" type="range" min="0" max="360" value="0" step="1" aria-label="차량 미리보기 각도"><span aria-hidden="true">↷</span></div></div>
    <section id="garage-shop" class="garage-shop" aria-label="차고 상점"><div class="garage-shop-heading"><span>내 취향을 골라봐요</span><span class="garage-shop-hint">꾸미기는 모두 같은 주행 성능</span></div><div id="garage-tabs" class="garage-tabs" role="tablist" aria-label="상점 종류"></div><div id="garage-items" class="garage-items" role="tabpanel" tabindex="0"></div><div class="garage-item-detail"><div class="garage-selection"><div><span class="garage-selection-type" id="garage-selection-type"></span><h3 id="garage-selection-name"></h3></div><strong id="garage-selection-price" class="garage-selection-price"></strong></div><p id="garage-selection-note" class="garage-selection-note"></p><div id="garage-item-actions" class="garage-item-actions"></div><p id="garage-notice" class="garage-notice" role="status" aria-live="polite"></p></div></section>
    <div class="garage-goals"><section class="garage-goal-card garage-wish-card" aria-label="목표 차량"><div><span class="garage-eyebrow">MY NEXT RIDE</span><strong id="garage-wish-name">브리즈 로드스터</strong><span id="garage-wish-note"></span></div><div class="garage-wish-track"><i id="garage-wish-progress"></i></div></section><section class="garage-goal-card garage-mission-card" aria-label="오늘의 미션"><div><span class="garage-eyebrow">TODAY · +15 C</span><strong id="garage-mission-title">새로운 길을 열어요</strong><span id="garage-mission-note"></span></div><button id="garage-mission" type="button" aria-label="오늘의 미션 달리기">→</button></section></div>`;
  const $=id=>panel.querySelector(`#${id}`);
  const setNotice=(text='',kind='info')=>{message=text;messageKind=kind;$('garage-notice').textContent=text;$('garage-notice').dataset.kind=kind;};
  const state=()=>readGarage()||emptyGarage();
  const owned=(garage,item)=>garage.owned?.includes(item.id)===true;
  const isEquipped=(garage,item)=>garage.equipped?.[item.kind]===item.value;
  const selected=()=>findItem(selectedId)||findItem('vehicle-coast');
  const persist=next=>{
    try{if(writeGarage(next)!==false)return true;}catch{/* Keep the current visual selection; no success claim. */}
    setNotice('기록을 저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.','error');return false;
  };

  function render(){
    const focused=panel.contains(document.activeElement)?document.activeElement:null;
    const focusTarget=focused?.dataset.item?`[data-item="${focused.dataset.item}"]`:focused?.dataset.category?`[data-category="${focused.dataset.category}"]`:focused?.dataset.action?`[data-action="${focused.dataset.action}"]`:null;
    let garage;
    try{garage=state();}catch{setNotice('차고 기록을 읽지 못했어요. 잠시 후 다시 열어 주세요.','error');return;}
    const item=selected();
    $('garage-coins').textContent=coins(garage.coins);
    $('garage-tabs').innerHTML=CATEGORIES.map(tab=>`<button type="button" id="garage-tab-${tab.id}" role="tab" aria-selected="${category===tab.id}" aria-controls="garage-items" data-category="${tab.id}" tabindex="${category===tab.id?'0':'-1'}">${tab.name}</button>`).join('');
    $('garage-items').setAttribute('aria-labelledby',`garage-tab-${category}`);
    $('garage-items').innerHTML=SHOP_ITEMS.filter(product=>product.kind===category).map(product=>{
      const have=owned(garage,product),equipped=isEquipped(garage,product),selected=product.id===selectedId;
      const label=equipped?'장착 중':have?'보유':product.unlockOnly?`${REWARD_CHAPTER[product.id]}장 결승 보상`:`${coins(product.price)} C`;
      return `<button type="button" class="garage-item${selected?' selected':''}${have?' owned':''}" data-item="${product.id}" aria-pressed="${selected}" aria-label="${escape(product.name)} · ${escape(label)} · 미리보기">${itemArt(product)}<span class="garage-item-name">${escape(product.name)}</span><span class="garage-item-state${equipped?' equipped':''}">${escape(label)}</span>${garage.wish===product.value&&product.kind==='vehicle'?'<i class="garage-item-wish" aria-label="찜한 차량">♡</i>':''}</button>`;
    }).join('');
    const have=owned(garage,item),equipped=isEquipped(garage,item);
    $('garage-selection-type').textContent=`${CATEGORIES.find(tab=>tab.id===item.kind)?.name||'꾸미기'} · ${equipped?'현재 장착':have?'보유 · 미리보기':'미리보기'}`;
    $('garage-selection-name').textContent=item.name;
    $('garage-selection-price').textContent=equipped?'장착 중':have?'보유':item.unlockOnly?'결승 보상':`${coins(item.price)} C`;
    $('garage-selection-note').textContent=item.unlockOnly&&!have?`${REWARD_CHAPTER[item.id]}장 결승에서 5문제 중 4문제 이상 맞히면 받을 수 있어요.`:item.description||(item.kind==='paint'?'차체에 어울리는 색을 골라보세요.':item.kind==='wheels'?'작은 변화로 차의 분위기를 바꿔보세요.':item.kind==='trail'?'정답 부스터가 켜질 때 이 색이 빛나요.':'코스를 완주한 순간을 담은 수집 배지예요.');
    const primary=equipped?'<button type="button" class="garage-primary" disabled>장착 중 ✓</button>':have?'<button type="button" class="garage-primary" data-action="equip">장착하고 달리기</button>':item.unlockOnly?'<button type="button" class="garage-primary garage-locked" disabled>결승에서 획득</button>':garage.coins<item.price?`<button type="button" class="garage-primary garage-locked" disabled>${coins(item.price-garage.coins)}코인 더 모아요</button>`:`<button type="button" class="garage-primary" data-action="buy">${coins(item.price)}코인으로 구매</button>`;
    const wish=item.kind==='vehicle'&&!have&&!item.unlockOnly?`<button type="button" class="garage-wish-button${garage.wish===item.value?' wished':''}" data-action="wish" aria-pressed="${garage.wish===item.value}">${garage.wish===item.value?'♡ 찜한 차':'♡ 목표로 찜하기'}</button>`:'';
    $('garage-item-actions').innerHTML=primary+wish;
    $('garage-preview-tag').textContent=equipped?'현재 장착 · 3D 보기':'미리보기 · 3D 보기';
    $('garage-preview-name').textContent=item.name;
    $('garage-preview-copy').textContent=item.kind==='vehicle'?'마린·까몽과 함께 달릴 차를 골라요.':`내 차에 ${item.name} 적용해 보기`;
    const wishVehicle=VEHICLES.find(v=>v.id===garage.wish&&!v.unlockOnly&&!garage.owned?.includes(`vehicle-${v.id}`));
    $('garage-wish-name').textContent=wishVehicle?wishVehicle.name:'다음 차를 찜해보세요';
    $('garage-wish-note').textContent=wishVehicle?garage.coins>=wishVehicle.price?'차고에서 구매할 수 있어요':`앞으로 ${coins(wishVehicle.price-garage.coins)}코인`:'마음에 드는 차량을 목표로 골라요.';
    $('garage-wish-progress').style.width=`${wishVehicle?Math.min(100,Math.max(0,garage.coins/wishVehicle.price*100)):0}%`;
    const mission=dailyMission(readProgress(),Date.now(),garage);
    $('garage-mission-title').textContent=mission.completed?'오늘의 미션 완료 ✓':mission.title;
    $('garage-mission-note').textContent=mission.completed?'오늘의 15코인을 받았어요.':mission.description;
    $('garage-mission').disabled=mission.completed;$('garage-mission').textContent=mission.completed?'✓':'→';
    setNotice(message,messageKind);
    if(focusTarget&&!focused.isConnected){
      const replacement=panel.querySelector(focusTarget)||panel.querySelector('[data-action="equip"]')||panel.querySelector(`[data-item="${selectedId}"]`);
      if(replacement&&!replacement.disabled)replacement.focus({preventScroll:true});
    }
  }

  function preview(itemId){
    const item=findItem(itemId);if(!item)return;
    selectedId=item.id;category=item.kind;setNotice();render();onPreview({...item});
  }
  function open(){
    if(!opened)returnFocus=document.activeElement;
    opened=true;panel.hidden=false;document.querySelector('.experience')?.classList.add('garage-open');
    const item=equippedItem(state(),'vehicle')||findItem('vehicle-coast');
    selectedId=item.id;category='vehicle';setNotice();render();onPreview({...item});$('garage-close').focus({preventScroll:true});
  }
  function close(){
    if(!opened)return;
    opened=false;panel.hidden=true;document.querySelector('.experience')?.classList.remove('garage-open');
    onClose();if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});
  }

  $('garage-close').addEventListener('click',close);
  $('garage-tabs').addEventListener('click',event=>{
    const tab=event.target.closest('[data-category]');if(!tab)return;
    category=tab.dataset.category;
    const garage=state(),item=equippedItem(garage,category)||SHOP_ITEMS.find(product=>product.kind===category);
    preview(item.id);$(`garage-tab-${category}`).focus({preventScroll:true});
  });
  $('garage-tabs').addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();const index=CATEGORIES.findIndex(tab=>tab.id===category);
    const target=event.key==='Home'?0:event.key==='End'?CATEGORIES.length-1:(index+(event.key==='ArrowRight'?1:-1)+CATEGORIES.length)%CATEGORIES.length;
    const garage=state(),kind=CATEGORIES[target].id,item=equippedItem(garage,kind)||SHOP_ITEMS.find(product=>product.kind===kind);
    preview(item.id);$(`garage-tab-${category}`).focus({preventScroll:true});
  });
  $('garage-items').addEventListener('click',event=>{
    const button=event.target.closest('[data-item]');if(!button)return;preview(button.dataset.item);
    panel.querySelector(`[data-item="${selectedId}"]`)?.focus({preventScroll:true});
  });
  $('garage-item-actions').addEventListener('click',event=>{
    const action=event.target.closest('[data-action]')?.dataset.action;if(!action)return;
    const item=selected();let latest;
    try{latest=state();}catch{setNotice('차고 기록을 읽지 못했어요. 잠시 후 다시 시도해 주세요.','error');return;}
    if(action==='wish'){
      if(!persist(setWish(latest,latest.wish===item.value?null:item.value)))return;
      setNotice(latest.wish===item.value?'다음 목표를 새로 골라도 좋아요.':`${item.name}를 다음 목표로 찜했어요.`);render();return;
    }
    const result=action==='buy'?buyItem(latest,item.id):equipItem(latest,item.id);
    if(!result.ok){
      const note=result.reason==='insufficient'?'코인이 조금 부족해요. 한 코스 더 달려볼까요?':result.reason==='owned'?'이미 가지고 있어요. 장착해서 달려보세요.':result.reason==='unowned'?'먼저 구매하거나 결승 보상으로 획득해 주세요.':'이 아이템은 결승 보상으로 만날 수 있어요.';
      setNotice(note,'error');render();return;
    }
    if(!persist(result.state))return;
    if(action==='equip'){setNotice(`${item.name} 장착했어요.`);render();onEquip({...item});onPreview({...item});}
    else{setNotice(`${item.name} 구매했어요. 장착해 함께 달려보세요.`);render();}
  });
  $('garage-mission').addEventListener('click',()=>{
    const mission=dailyMission(readProgress(),Date.now(),state());if(mission.completed)return;close();onMission(mission);
  });
  panel.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();return;}
    if(event.key!=='Tab')return;
    const focusable=[...panel.querySelectorAll('button:not(:disabled),input:not(:disabled),[tabindex="0"]')].filter(element=>element.getClientRects().length>0);
    const first=focusable[0],last=focusable.at(-1);if(!first)return;
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  });
  render();
  return {render,open,close,get previewItem(){return {...selected()};}};
}
