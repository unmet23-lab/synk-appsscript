import {CATALOG,CATEGORIES} from './shop.mjs';
import {shopIcon} from './shop-assets.mjs';
const $=id=>document.getElementById(id);
export function createShopUI({store,world,onOpen=()=>{},onClose=()=>{},onStateChange=()=>{},announce=()=>{}}){
  let visible=false,category='trail',selected=CATALOG.find(i=>i.category===category),returnFocus=null;
  function state(){return store.snapshot();}
  function framePreview(){const r=document.querySelector('.shop-preview').getBoundingClientRect();world.setShopPreview(true,{previewTop:r.top,previewHeight:r.height});}
  function preview(item){selected=item;world.previewCosmetics({...state().equipped,[item.category]:item.style});$('shop-preview-name').textContent=item.name;$('shop-preview-description').textContent=item.description;render();}
  function message(text){$('shop-message').textContent=text;announce(text);}
  function render(){
    const focusKey=document.activeElement?.dataset.shopFocus;
    const s=state();$('shop-wallet').textContent=s.wallet;
    $('shop-categories').replaceChildren(...CATEGORIES.map(c=>{const b=document.createElement('button');b.type='button';b.dataset.shopFocus='category:'+c.id;b.textContent=c.name;b.className=c.id===category?'active':'';b.setAttribute('aria-pressed',String(c.id===category));b.addEventListener('click',()=>{category=c.id;selected=CATALOG.find(i=>i.category===category&&i.style===state().equipped[category]);preview(selected);message('');});return b;}));
    $('shop-items').replaceChildren(...CATALOG.filter(i=>i.category===category).map(item=>{
      const b=document.createElement('button');b.type='button';b.dataset.shopFocus='item:'+item.id;b.className='shop-card'+(item.id===selected.id?' selected':'');b.setAttribute('aria-pressed',String(item.id===selected.id));
      const art=document.createElement('span');art.className='shop-card-art';const img=document.createElement('img');img.src=shopIcon(item.category,item.style);img.alt='';img.width=128;img.height=128;art.append(img);
      const title=document.createElement('strong');title.textContent=item.name;const status=document.createElement('span');status.className='shop-card-status';
      const equipped=s.equipped[item.category]===item.style,owned=s.owned.includes(item.id),wishlisted=!owned&&s.wishlist===item.id;status.textContent=equipped?'장착 중':owned?'보유 중':`✦ ${item.price}${wishlisted?' · 찜한 상품':''}`;b.classList.toggle('wishlisted',wishlisted);
      if(equipped){const check=document.createElement('img');check.className='shop-equipped-check';check.src='assets/shop/ui/badge-check.webp';check.alt='';art.append(check);}
      b.setAttribute('aria-label',item.name+' · '+status.textContent+' · 미리보기');b.addEventListener('click',()=>{preview(item);message('');});b.append(art,title,status);return b;
    }));
    $('shop-selection-category').textContent=CATEGORIES.find(c=>c.id===category).name;
    $('shop-selection-name').textContent=selected.name;$('shop-selection-description').textContent=selected.description;
    const owned=s.owned.includes(selected.id),equipped=s.equipped[selected.category]===selected.style;
    const button=$('shop-purchase');button.disabled=!s.available||equipped||(!owned&&s.wallet<selected.price);
    button.textContent=!s.available?'저장을 사용할 수 없어요':equipped?'지금 장착하고 있어요':owned?'이 모습으로 장착하기':s.wallet<selected.price?`별 ${selected.price-s.wallet}개 더 모으면 살 수 있어요`:`별 ${selected.price}개로 구매하고 장착`;
    const wishButton=$('shop-wishlist-toggle');if(wishButton){const wishlisted=s.wishlist===selected.id;wishButton.hidden=owned||selected.price===0;wishButton.disabled=!s.available;wishButton.setAttribute('aria-pressed',String(wishlisted));wishButton.setAttribute('aria-label',selected.name+(wishlisted?' 찜 해제':' 찜하기'));wishButton.textContent=wishlisted?'♥ 찜 해제':'♡ 찜하기';}
    if(!s.available)$('shop-message').textContent='브라우저 저장을 사용할 수 없어 구매하지 않았어요.';
    if(focusKey)[...$('shop-panel').querySelectorAll('button')].find(b=>b.dataset.shopFocus===focusKey)?.focus();
  }
  function open(itemId){const requested=typeof itemId==='string'?CATALOG.find(item=>item.id===itemId):null;if(visible){if(requested){category=requested.category;preview(requested);}return;}returnFocus=document.activeElement;if(requested)selected=requested;onOpen();visible=true;document.body.classList.add('shopping');$('shop-panel').hidden=false;framePreview();category=selected.category;preview(selected);message('상품을 골라 먼저 입혀보세요. 미리보기에는 별을 쓰지 않아요.');$('shop-close').focus();}
  function close(){if(!visible)return;visible=false;world.setShopPreview(false);world.setCosmetics(state().equipped);$('shop-panel').hidden=true;document.body.classList.remove('shopping');onClose();returnFocus?.focus();}
  $('shop-button').addEventListener('click',open);$('result-shop').addEventListener('click',open);$('shop-close').addEventListener('click',close);
  $('shop-reset-preview').addEventListener('click',()=>{world.previewCosmetics(state().equipped);selected=CATALOG.find(i=>i.category===category&&i.style===state().equipped[category]);$('shop-preview-name').textContent='지금 장착한 모습';$('shop-preview-description').textContent='다음 달리기에 이 모습이 적용돼요.';render();message('장착한 모습으로 돌아왔어요.');});
  $('shop-purchase').addEventListener('click',()=>{const owned=state().owned.includes(selected.id),result=owned?store.equip(selected.id):store.buy(selected.id);if(!result.ok){message(result.reason==='insufficient-stars'?'별을 조금 더 모아 주세요.':result.reason==='already-owned'?'이미 가지고 있는 상품이에요.':'저장하지 못해 별을 쓰지 않았어요.');render();return;}world.previewCosmetics(result.state.equipped);render();message(owned?selected.name+' 장착했어요.':selected.name+' 구매하고 장착했어요.');onStateChange({type:owned?'equip':'buy',result});});
  $('shop-wishlist-toggle')?.addEventListener('click',()=>{const clear=state().wishlist===selected.id,result=store.setWishlist(clear?null:selected.id);if(!result.ok){render();message(result.reason==='storage-unavailable'?'저장하지 못해 찜을 바꾸지 않았어요.':'이 상품을 찜할 수 없어요.');return;}render();message(clear?'찜을 해제했어요.':selected.name+' 찜했어요. 다음 달리기에서 별을 모아 봐요.');onStateChange({type:'wishlist',result});});
  $('shop-panel').addEventListener('keydown',e=>{if(e.key!=='Tab')return;const all=[...$('shop-panel').querySelectorAll('button')].filter(el=>!el.disabled&&el.getClientRects().length),first=all[0],last=all.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}});
  window.addEventListener('resize',()=>{if(visible)framePreview();});
  return {open,close,refresh:()=>{if(visible)render();},get visible(){return visible;},get info(){return{visible,category,selected:selected.id,wishlist:state().wishlist??null};}};
}
