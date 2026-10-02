import {CATALOG,goalProgress} from './shop.mjs';
import {shopIcon} from './shop-assets.mjs';

const $=id=>document.getElementById(id);
const text=(tag,className,value)=>{const el=document.createElement(tag);el.className=className;el.textContent=value;return el;};

/** Compact travel rewards for stopped screens; no language evaluation or in-run text. */
export function createJourneyUI({store,onOpenShop=()=>{}}){
  let lastReward=null,lastInfo=null;
  function shopButton(itemId=null){
    const b=text('button','journey-shop-button','상점 보기');b.type='button';
    b.setAttribute('aria-label',itemId?'찜한 상품을 상점에서 보기':'바람상점에서 갖고 싶은 꾸미기 고르기');
    b.addEventListener('click',()=>onOpenShop(itemId));return b;
  }
  function renderNextGoal(container,next){
    if(!container)return;
    const card=document.createElement('div');card.className='journey-goal-card';
    if(!next){
      const img=document.createElement('img');img.className='journey-goal-seal';img.src='assets/shop/ui/badge-check.webp';img.alt='';img.width=32;img.height=32;
      const copy=text('div','journey-goal-copy','');copy.append(text('strong','journey-goal-title','여행 목표를 모두 해냈어요'),text('span','journey-goal-meta','다음에는 다른 모습으로 달려봐요.'));card.append(img,copy);container.replaceChildren(card);return;
    }
    const head=document.createElement('div');head.className='journey-goal-heading';head.append(text('strong','journey-goal-title',next.name),text('span','journey-goal-reward',`+${next.reward}별`));
    const progress=document.createElement('span');progress.className='journey-goal-progress';progress.setAttribute('role','progressbar');progress.setAttribute('aria-label',next.name);progress.setAttribute('aria-valuemin','0');progress.setAttribute('aria-valuemax',String(next.target));progress.setAttribute('aria-valuenow',String(next.current));progress.setAttribute('aria-valuetext',`${next.current} / ${next.target}${next.unit}`);
    const bar=document.createElement('i');bar.style.width=(next.progress*100)+'%';progress.append(bar);
    card.append(head,text('span','journey-goal-meta',`${next.current} / ${next.target}${next.unit} · 달성하면 보너스`),progress);container.replaceChildren(card);
  }
  function renderWishlist(container,item,s){
    if(!container)return;
    const row=document.createElement('div');row.className='wishlist-goal-row';
    if(!item){row.classList.add('empty');row.append(text('span','wishlist-goal-empty','갖고 싶은 꾸미기를 골라봐요.'),shopButton());container.replaceChildren(row);return;}
    const image=document.createElement('img');image.className='wishlist-goal-icon';image.src=shopIcon(item.category,item.style);image.alt='';image.width=44;image.height=44;
    const copy=document.createElement('div');copy.className='wishlist-goal-copy';const remaining=Math.max(0,item.price-s.wallet);
    copy.append(text('strong','wishlist-goal-title',item.name),text('span','wishlist-goal-meta',`${s.wallet} / ${item.price}별 · ${remaining?remaining+'별 더 모으면 돼요':'이제 살 수 있어요'}`));
    row.append(image,copy,shopButton(item.id));container.replaceChildren(row);
  }
  function renderResult(container,next,item,s){
    if(!container)return;
    const lines=[];
    const unlocked=lastReward?.ok&&!lastReward.automatic&&!lastReward.duplicate?lastReward.goalsUnlocked||[]:[];
    if(unlocked.length)lines.push(text('p','result-goals-earned',`여행 목표 달성: ${unlocked.map(goal=>goal.name).join(' · ')} · +${lastReward.goalBonus}별`));
    else if(next)lines.push(text('p','result-goals-next',`다음 목표: ${next.name} · ${next.current} / ${next.target}${next.unit} · 보너스 ${next.reward}별`));
    else lines.push(text('p','result-goals-next','여행 목표를 모두 해냈어요.'));
    if(item){const remaining=Math.max(0,item.price-s.wallet);lines.push(text('p','result-goals-wishlist',`찜한 ${item.name} · ${remaining?remaining+'별 더 모으면 살 수 있어요':'이제 상점에서 살 수 있어요'}`));}
    container.replaceChildren(...lines);
  }
  function refresh(reward){
    if(reward!==undefined)lastReward=reward;
    const s=store.snapshot(),goals=goalProgress(s),next=goals.find(goal=>!goal.claimed)||null;
    const item=CATALOG.find(item=>item.id===s.wishlist&&!s.owned.includes(item.id)&&item.price>0)||null;
    renderNextGoal($('journey-goals'),next);renderWishlist($('wishlist-goal'),item,s);renderResult($('result-goals'),next,item,s);
    lastInfo={nextGoal:next?{id:next.id,current:next.current,target:next.target,claimed:next.claimed}:null,wishlist:item?{id:item.id,wallet:s.wallet,price:item.price,remaining:Math.max(0,item.price-s.wallet)}:null,goalsUnlocked:lastReward?.ok&&!lastReward.automatic&&!lastReward.duplicate?(lastReward.goalsUnlocked||[]).map(goal=>goal.id):[]};
    return lastInfo;
  }
  return {refresh,info(){return lastInfo;}};
}
