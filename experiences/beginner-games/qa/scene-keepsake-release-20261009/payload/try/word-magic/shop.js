import {MagicStage} from './stage.js';
import {LAB_OBJECTS,LAB_SETS} from './content.js';

const names={
 'magic-scene-default':['Adventure sky','모험의 하늘'],
 'magic-scene-sunset':['Peach sunset','복숭아 노을'],
 'magic-scene-night':['Lapis evening','라피스 저녁'],
 'magic-frame-cream':['Cream frame','크림 사진틀'],
 'magic-frame-coral':['Coral frame','코랄 사진틀'],
 'magic-frame-lapis':['Lapis frame','라피스 사진틀'],
 'magic-toys-default':['The magic workshop','기본 마법 실험실'],
 'magic-toys-picnic':['Bear’s picnic set','곰의 소풍 실험 세트']
};
const defaultLook={scene:'default',frame:'cream',toys:'default'};
const appearance=wallet=>({scene:wallet?.equipped?.['magic-scene']||'default',frame:wallet?.equipped?.['magic-frame']||'cream',toys:wallet?.equipped?.['magic-toys']||'default'});

/** Uses the same wallet, ownership and persisted purchase operations as racing's garage. */
export class MagicShop{
 constructor({say,onApply,onOpen,onUse,onProgress}){
  this.say=say;this.onApply=onApply;this.onOpen=onOpen;this.onUse=onUse;this.onProgress=onProgress;this.wallet=null;this.progress=null;this.rewardRoute=null;this.refreshVersion=0;this.items=[];this.look={...defaultLook};this.preview={...defaultLook};this.busy=false;this.previewId=null;this.message='';this.previewVersion=0;this.lastEquipped=null;this.viewEpoch=0;
  this.dialog=document.querySelector('#shop-dialog');
  this.stage=new MagicStage(document.createElement('canvas'),document.createElement('div'),()=>{});this.thumbnails=new Map();
  this.ready=this.stage.load().then(()=>this.stage.set(LAB_OBJECTS,{animate:false}));this.ready.catch(()=>{});
  document.querySelector('#shop-close').onclick=()=>this.dialog.close();
  this.dialog.addEventListener('close',()=>{this.viewEpoch++;this.onProgress?.();if(!this.skipReturnFocus){const target=this.opener?.id?document.getElementById(this.opener.id):this.opener;target?.focus({preventScroll:true});}this.skipReturnFocus=false;});
  document.querySelector('#shop-language').onclick=()=>{document.querySelector('#language').click();this.message='';this.render();};
  document.querySelector('#shop-retry').onclick=()=>this.refresh();
  document.querySelector('#shop-use').onclick=()=>{const item=this.items.find(x=>x.id===this.lastEquipped);if(item)this.onUse?.(item);};
  for(const button of document.querySelectorAll('[data-magic-shop]'))button.onclick=()=>this.open(button);
  window.addEventListener('storage',e=>{if(e.key===globalThis.SynkPlayCollection?.key)this.refresh();});
  window.addEventListener('pageshow',()=>this.refresh());
  window.addEventListener('synk:collection-change',()=>{if(!this.busy)this.refresh();});
  this.refresh();
 }
 async refresh(){
  const api=globalThis.SynkPlayCollection,version=++this.refreshVersion;
  try{const [wallet,items,progress,route]=await Promise.all([api?.load(),api?.catalog(),api?.beginnerProgress?.('word-magic'),api?.beginnerRewardRoute?.('word-magic')]);if(version!==this.refreshVersion)return;this.wallet=wallet||null;this.progress=progress||null;this.rewardRoute=route||null;this.items=(items||[]).filter(x=>Object.hasOwn(names,x.id));}
  catch{if(version!==this.refreshVersion)return;this.wallet=null;this.progress=null;this.rewardRoute=null;this.items=[];}
  if(this.wallet)this.look=appearance(this.wallet);this.onApply(this.look);if(!this.previewId)this.preview={...this.look};this.labels();this.onProgress?.();if(this.dialog.open)this.render();
 }
 labels(){
  for(const b of document.querySelectorAll('[data-magic-shop]'))b.textContent=this.say('Magic shop','마법 상점');
  const balance=document.querySelector('#magic-balance');if(balance)balance.textContent=this.wallet?this.say(`${this.wallet.coins} shared coins`, `공통 코인 ${this.wallet.coins}`):this.say('Wallet unavailable','지갑 연결 안 됨');
 }
 async open(opener){
  if(this.dialog.open)return;this.viewEpoch++;this.opener=opener;this.onOpen?.();this.previewId=null;this.message='';this.preview={...this.look};this.render();this.dialog.showModal();await this.refresh();
 }
 closeForPlay(){if(!this.dialog.open)return;this.skipReturnFocus=true;this.dialog.close();}
 async drawPreview(){
  const version=++this.previewVersion;
  try{await this.ready;this.stage.set(LAB_SETS[this.preview.toys||'default'].objects,{animate:false});this.stage.appearance(this.preview);const blob=await this.stage.photo();if(version!==this.previewVersion)return;const image=document.querySelector('#shop-preview');if(this.previewURL)URL.revokeObjectURL(this.previewURL);this.previewURL=URL.createObjectURL(blob);image.src=this.previewURL;image.alt=this.say('Preview of your toys, scene and saved photo frame','소품 세트·장면 배경·저장될 사진틀 미리보기');}
  catch{document.querySelector('#shop-preview-label').textContent=this.say('Preview could not load. Close and try again.','미리보기를 불러오지 못했어요. 닫고 다시 시도해 주세요.');}
 }
 thumbnail(item){
  if(!this.thumbnails.has(item.id))this.thumbnails.set(item.id,this.ready.then(async()=>{const scene=new MagicStage(document.createElement('canvas'),document.createElement('div'),()=>{});scene.images=this.stage.images;scene.set(item.kind==='magic-toys'?LAB_SETS[item.value].objects:LAB_OBJECTS,{animate:false});scene.appearance({scene:item.kind==='magic-scene'?item.value:'default',frame:item.kind==='magic-frame'?item.value:'cream'});const blob=await scene.photo();return URL.createObjectURL(blob);}));return this.thumbnails.get(item.id);
 }
 name(item){return this.say(...(names[item.id]||[item.name,item.name]));}
 focusSnapshot(root){
  const node=document.activeElement;if(!root?.contains(node))return null;let selector;
  if(node.dataset.shopAction)selector=`[data-shop-action="${node.dataset.shopAction}"]`;
  else if(node.dataset.goal)selector=`[data-goal="${node.dataset.goal}"]`;
  else if(node.matches('.shop-swatch'))selector=`[data-item="${node.closest('[data-item]').dataset.item}"] .shop-swatch`;
  else if(node.id)selector=`#${node.id}`;
  else if(node.matches('.magic-goal > .text-button'))selector=`#${node.parentElement.id} > .text-button`;
  return selector?{node,selector,fallback:node.closest('#shop-dialog')?'#shop-language':`#${root.id}-choose`}:null;
 }
 restoreFocus(snapshot){
  if(!snapshot||document.activeElement!==document.body&&document.activeElement!==snapshot.node)return;
  let target=document.querySelector(snapshot.selector);if(!target||target.disabled||!target.getClientRects().length)target=document.querySelector(snapshot.fallback);
  if(target&&!target.disabled&&target.getClientRects().length)target.focus({preventScroll:true});
 }
 goalView(node){
  if(!node)return;const focus=this.focusSnapshot(node);try{node.replaceChildren();const s=this.say,p=this.progress,g=p?.goal;const heading=document.createElement('h3');heading.textContent=s('Something to look forward to','내가 고른 다음 즐거움');node.append(heading);
  const copy=document.createElement('p');if(!g){copy.textContent=s('Choose a toy set, backdrop or frame you would like. You can change your goal at any time.','갖고 싶은 소품·배경·사진틀을 직접 골라요. 목표는 언제든 바꿀 수 있어요.');node.append(copy);if(!this.dialog.open){const choose=document.createElement('button');choose.id=`${node.id}-choose`;choose.className='small-button';choose.textContent=s('Choose my goal','내 목표 고르기');choose.onclick=()=>this.open(choose);node.append(choose);}return;}
  copy.textContent=p.owned?s(`${this.name(g)} · Yours!`,`${this.name(g)} · 목표 달성!`):s(`${this.name(g)} · ${p.remaining} more coins`,`${this.name(g)} · 코인 ${p.remaining}개 더`);node.append(copy);
  const meter=document.createElement('div');meter.className='magic-goal-meter';meter.setAttribute('role','progressbar');meter.setAttribute('aria-label',this.name(g));meter.setAttribute('aria-valuemin','0');meter.setAttribute('aria-valuemax',String(g.price));meter.setAttribute('aria-valuenow',String(p.owned?g.price:Math.min(p.coins,g.price)));const fill=document.createElement('span');fill.style.width=`${p.owned?100:Math.min(100,p.coins/g.price*100)}%`;meter.append(fill);node.append(meter);
  const needsCoins=!p.owned&&!p.affordable,route=this.rewardRoute;
  const action=document.createElement(needsCoins?'a':'button');action.id=`${node.id}-action`;action.className='secondary-button';
  if(needsCoins){action.href=route?.href||'/try/learning-hub/#beginner-title';action.textContent=route?s(route.labelEn,route.label):s('Choose my next free activity','다음 무료 학습 고르기');const detail=document.createElement('p');detail.textContent=route?s(route.descriptionEn,route.description):s('Learning stays free. Check the save connection for reward guidance.','학습은 계속 무료예요. 보상 안내는 저장 연결을 확인해 주세요.');node.append(detail);}
  else{action.textContent=p.owned?s('Use it in my playground','실험실에서 바로 사용'):s('My goal is ready to buy','모았어요 · 구매하러 가기');action.onclick=()=>{if(p.owned)this.onUse?.(g);else{this.open(action);this.previewId=g.id;this.preview={...this.look,[g.kind.replace('magic-','')]:g.value};this.render();}};}node.append(action);
  const clear=document.createElement('button');clear.className='text-button';clear.textContent=s('Clear goal','목표 해제');clear.onclick=()=>this.setGoal(null);node.append(clear);}finally{this.restoreFocus(focus);}
 }
 async setGoal(id){if(this.busy)return;const viewEpoch=this.viewEpoch;this.busy=true;try{const result=await globalThis.SynkPlayCollection.setBeginnerGoal('word-magic',id);if(viewEpoch===this.viewEpoch)this.message=result.ok?this.say(id?'Your goal is saved.':'Your goal is cleared.',id?'내 목표를 저장했어요.':'목표를 해제했어요.'):this.say('Could not save the goal. Check the account save status above and try again.','목표를 저장하지 못했어요. 화면 위의 저장 상태를 확인하고 다시 시도해 주세요.');}catch{if(viewEpoch===this.viewEpoch)this.message=this.say('Could not save the goal. Please try again.','목표를 저장하지 못했어요. 다시 시도해 주세요.');}this.busy=false;await this.refresh();this.render();}
 render(){
  const focus=this.focusSnapshot(this.dialog);
  const s=this.say;this.labels();document.querySelector('#shop-title').textContent=s('Your magic shop','나만의 마법 상점');document.querySelector('#shop-close').textContent=s('Back to playing','놀이로 돌아가기');document.querySelector('#shop-language').textContent=document.documentElement.lang==='ko'?'English':'한국어';
  document.querySelector('#shop-copy').textContent=s('Each finished adventure earns 15 coins once. In either playground, hear and make 3 different changes with 2 words and 2 objects for +5 coins once a day. The shared daily reward limit applies.','모험 완주는 장마다 한 번 15코인. 어느 실험실에서든 소리를 듣고 두 말·두 물건으로 서로 다른 변화 3번을 만들면 하루 한 번 5코인을 받아요. 공통 일일 보상 한도가 적용돼요.');
  document.querySelector('#shop-note').textContent=s('Every word, adventure and the original playground stays free. Sign in with SYNK ID to keep purchases across devices. Check account save status above.','모든 표현·모험·기본 실험실은 계속 무료예요. SYNK ID로 연결하면 구매품을 다른 기기에서도 쓸 수 있어요. 저장 상태는 화면 위에서 확인해요.');
  document.querySelector('#shop-wallet').textContent=this.wallet?s(`${this.wallet.coins} shared coins`,`공통 코인 ${this.wallet.coins}개`):s('Your wallet is unavailable. Try again when browser storage is available.','지갑을 열지 못했어요. 브라우저 저장을 허용한 뒤 다시 시도해 주세요.');
  document.querySelector('#shop-retry').hidden=!!this.wallet&&this.items.length===8;document.querySelector('#shop-retry').textContent=s('Try wallet again','지갑 다시 연결');
  document.querySelector('#shop-feedback').textContent=this.message;
  this.goalView(document.querySelector('#shop-goal'));const use=document.querySelector('#shop-use');use.hidden=!this.lastEquipped||!this.wallet?.owned?.includes(this.lastEquipped);use.textContent=s('Use it in my playground','실험실에서 바로 사용');
  const previewItem=this.items.find(x=>x.id===this.previewId);
  const previewEquipped=previewItem&&this.wallet?.equipped?.[previewItem.kind]===previewItem.value;
  document.querySelector('#shop-preview-label').textContent=previewItem?(previewEquipped?s(`Equipped · ${names[previewItem.id][0]}`,`장착 중 · ${names[previewItem.id][1]}`):s(`Preview · ${names[previewItem.id][0]} · not equipped`,`미리보기 · ${names[previewItem.id][1]} · 아직 적용 전`)):s('Your equipped scene and photo frame','지금 장착한 장면과 사진틀');
  for(const kind of ['toys','scene','frame']){
   document.querySelector(`#shop-${kind}-title`).textContent=kind==='toys'?s('New things to play with','배운 말로 놀 새 소품'):kind==='scene'?s('Scene backdrop','장면 배경'):s('Saved photo frame','저장할 사진틀');
   const group=document.querySelector(`#shop-${kind}-items`);group.replaceChildren();
   for(const item of this.items.filter(x=>x.kind===`magic-${kind}`)){
    const owned=this.wallet?.owned?.includes(item.id),equipped=this.wallet?.equipped?.[item.kind]===item.value,shortfall=Math.max(0,item.price-(this.wallet?.coins||0));
    const card=document.createElement('article');card.className='magic-shop-item';card.dataset.item=item.id;
    const sample=document.createElement('button');sample.className=`shop-swatch ${kind}-${item.value}`;sample.type='button';sample.setAttribute('aria-label',s(`Preview ${names[item.id][0]}`,`${names[item.id][1]} 미리보기`));sample.setAttribute('aria-pressed',String(this.previewId===item.id));sample.disabled=this.busy;
    const image=document.createElement('img');image.src='assets/scenes/village.webp';image.alt='';sample.classList.add('has-photo');sample.append(image);this.thumbnail(item).then(url=>{image.src=url;sample.dataset.ready='true';}).catch(()=>{});sample.onclick=()=>{this.previewId=item.id;this.preview={...this.look,[kind]:item.value};this.message='';this.render();};
    const name=document.createElement('h4');name.textContent=s(...names[item.id]);
    const detail=document.createElement('p');detail.className='shop-item-detail';detail.textContent=equipped?s('Equipped','장착 중'):owned?s('Owned · equip for free','보유 중 · 무료 장착'):s(`${item.price} coins`,`${item.price} 코인`);
    const purpose=document.createElement('p');purpose.className='shop-item-purpose';purpose.textContent=kind==='toys'?(item.value==='picnic'?s('A ring for Bear, a snack to share, a secret in the chest. Use the words you already know.','곰에게 맞는 튜브, 나눌 간식, 상자 속 비밀. 이미 배운 말로 바꿔 봐요.'):s('Four free toys. Try every word as you learn it.','무료 소품 네 가지. 새로 배운 말을 마음껏 써요.')):kind==='scene'?s('Set the mood for every adventure and photo.','모험과 사진의 분위기를 바꿔요.'):s('Give the pictures you make a frame to keep.','직접 만든 장면을 사진틀에 담아요.');
    const action=document.createElement('button');action.className=owned?'small-button':'secondary-button';action.type='button';action.dataset.shopAction=item.id;action.disabled=this.busy||!this.wallet||equipped||(!owned&&shortfall>0);action.textContent=equipped?s('Equipped','장착 중'):owned?s('Equip','장착하기'):shortfall?s(`Need ${shortfall} more`,`${shortfall}개 더 필요`):s(`Buy · ${item.price}`,`${item.price}개로 구매`);action.onclick=()=>this.act(item);
    card.append(sample,name,purpose,detail,action);if(item.price>0){const goal=document.createElement('button');goal.type='button';goal.className='text-button shop-goal-choice';goal.dataset.goal=item.id;goal.setAttribute('aria-pressed',String(this.progress?.goal?.id===item.id));goal.disabled=this.busy||!this.wallet;goal.textContent=this.progress?.goal?.id===item.id?s('My goal · clear','내 목표 · 해제'):s('Make this my goal','내 목표로 고르기');goal.onclick=()=>this.setGoal(this.progress?.goal?.id===item.id?null:item.id);card.append(goal);}if(owned){const useItem=document.createElement('button');useItem.type='button';useItem.className='text-button';useItem.textContent=s('Play with this','바로 사용하기');useItem.dataset.use=item.id;useItem.onclick=()=>this.onUse?.(item);card.append(useItem);}group.append(card);
   }
  }
  this.drawPreview();this.restoreFocus(focus);
 }
 async act(item){
  if(this.busy)return;const focus=this.focusSnapshot(this.dialog),viewEpoch=this.viewEpoch;let moved=false;const cancelFocus=()=>{moved=true;};document.addEventListener('pointerdown',cancelFocus,true);document.addEventListener('keydown',cancelFocus,true);
  this.busy=true;this.message='';this.render();const waitFocus=document.activeElement,api=globalThis.SynkPlayCollection;let result,purchased=false;
  try{try{const current=await api.load();if(!current)throw Error('storage');if(!current.owned.includes(item.id)){result=await api.buy(item.id);if(!result.ok&&result.reason!=='owned')throw result;purchased=result.ok;}result=await api.equip(item.id);if(!result.ok)throw result;if(viewEpoch===this.viewEpoch){this.previewId=null;this.lastEquipped=item.id;this.message=this.say(`${names[item.id][0]} is equipped.`,`${names[item.id][1]}을 장착했어요.`);}}
  catch(error){if(viewEpoch===this.viewEpoch)this.message=purchased?this.say('Purchased and owned, but equipping could not be saved. Try Equip again for free.','구매하여 보유 중이지만 장착을 저장하지 못했어요. 무료로 다시 장착해 주세요.'):error.reason==='insufficient'?this.say('Your balance changed. Earn a few more coins and try again.','코인 잔액이 바뀌었어요. 코인을 더 모아 다시 시도해 주세요.'):this.say('Could not save this change. Your equipped decoration has not changed. Check the account save status above and try again.','변경을 저장하지 못했어요. 장착은 그대로예요. 화면 위의 저장 상태를 확인한 뒤 다시 시도해 주세요.');}
  this.busy=false;await this.refresh();if(viewEpoch===this.viewEpoch){this.render();if(focus&&!moved&&this.dialog.open&&document.activeElement===waitFocus){const action=document.querySelector(focus.selector);(action&&!action.disabled?action:document.querySelector(`[data-item="${item.id}"] .shop-swatch`))?.focus({preventScroll:true});}}
  }finally{document.removeEventListener('pointerdown',cancelFocus,true);document.removeEventListener('keydown',cancelFocus,true);}
 }
}
