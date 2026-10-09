const PUBLIC_GAME_SLUGS={"korean-racing":"racing","korean-runner":"runner","korean-rhythm":"rhythm","word-magic":"word-magic","spaceship-coop":"spaceship-coop","learning-hub":"learning-hub","order-rush":"order-rush","entry-check":"entry-check","blank-slice":"blank-slice","talk-rally":"talk-rally","story-classroom":"story-classroom"};
const gameList=[
 ['racing','한국어 레이싱','다음 완주를 향한 나의 차고','korean-racing','medal','완주 기록과 모은 칭호를 확인하고, 나만의 차로 다시 출발해요.',''],
 ['rhythm','말의 리듬','듣고 연주하며 쌓이는 플레이 기록','korean-rhythm','headphones','한국어 소리와 리듬에 귀를 기울여요. 모은 코인으로 고른 무대에서 다음 한 곡을 시작해요.',''],
 ['order-rush','주문 폭주','손님의 주문을 듣고 차리는 한 잔','order-rush','coffee','주문에 맞게 재료를 담고 손님에게 건네요. 내 가게의 꾸미기와 지금까지의 영업 기록을 함께 모아요.',''],
 ['runner','바람길','짧은 부탁을 듣고 움직이는 여행','korean-runner','lantern','한국어로 들리는 부탁에 맞춰 움직여요. 한 판을 마친 기록을 남기고 다시 여행해요.',''],
 ['entry-check','입장 검사','규칙을 읽고 손님을 맞이하는 근무','entry-check','stamp','손님의 표와 입장 조건을 확인해요. 한 번씩 판단하며 쌓은 근무 기록과 칭호를 살펴봐요.',''],
 ['story-classroom','선생님이 돌아왔다','친구의 부탁으로 이어지는 이야기','story-classroom','notebook','친구의 말을 듣고 필요한 물건을 옮겨요. 이야기를 끝낸 기록과 모은 칭호가 남아요.',''],
 ['blank-slice','빈칸 베기','빈칸에 맞는 표현을 고르는 한 판','blank-slice','sparkle','문장의 빈칸에 알맞은 표현을 골라 베어요. 모은 기록을 확인하고 다음 한 판으로 이어 가요.','']
];
const beginnerShops=[
 ['magic','말의 마법사','Word Magic','새 소품에 배운 말을 써 보고 사진으로 남겨요.','Try familiar words on new toys, then take a photo.','/try/word-magic/?shop=1','word-magic',['magic-scene','magic-frame','magic-toys']],
 ['order','첫 가게','Your First Shop','세 친구의 주문을 듣고 소풍을 완성해요.','Listen, serve three friends, and enjoy a picnic.','/try/order-rush/beginner.html?shop=1','order-rush',['order-stall','order-tray','order-playset']],
 ['ship','둘이서 우주선 고치기','Fix the Spaceship','함께 끝낸 탐험이 우리의 별지도가 돼요.','Turn your completed expeditions into a starbook.','/try/spaceship-coop/?shop=1','spaceship-coop',['ship-sky','ship-badge','ship-keepsake']]
];
const shopArt={magic:['/try/word-magic/assets/objects/rabbit.webp','/try/word-magic/assets/objects/camera.webp'],order:['/try/spaceship-coop/assets/brand/mongle-smile.webp','/try/order-rush/beginner-assets/beginner/bread.webp'],ship:['/try/spaceship-coop/assets/art/felt-rocket-v2.webp','/try/spaceship-coop/assets/felt/sparkle.webp']};
for(const [id,name,en,copy,copyEn,href] of beginnerShops){const card=document.createElement('article');card.className='beginner-shop-card';card.dataset.beginnerShop=id;card.innerHTML=`<span class="beginner-card-art art-${id}" aria-hidden="true"><img src="${shopArt[id][0]}" alt="" width="140" height="186"><img class="art-companion" src="${shopArt[id][1]}" alt="" width="80" height="80"></span><h3>${name}<span lang="en">${en}</span></h3><p>${copy}<br><span lang="en">${copyEn}</span></p><div class="shop-play-owned" hidden><span class="owned-play-label">내가 모은 놀이 · <span lang="en">Yours to play</span></span><a class="shop-use"><img alt="" width="52" height="52"><span><b></b><span lang="en"></span></span></a></div><span class="shop-goal" role="status"></span><span class="shop-owned"></span><a class="shop-visit" href="${href}"><strong>상점에서 골라 보기 · <span lang="en">Visit shop</span> →</strong></a>`;document.getElementById('beginner-shop-cards').append(card);}
function updateOwnedPlay(card,id,state){
 const owned=state.items.filter(item=>item.owned&&item.price>0),host=card.querySelector('.shop-play-owned'),link=host.querySelector('a');
 host.hidden=!state.available||owned.length===0;if(host.hidden){link.removeAttribute('href');delete link.dataset.ownedPlay;return;}
 let href,ko,en,image,item;
 if(id==='magic'){
  item=(state.goal?.owned&&state.goal)||owned.find(i=>i.id==='magic-toys-picnic')||owned.find(i=>i.equipped)||owned[0];
  href=`/try/word-magic/?play=lab&item=${encodeURIComponent(item.id)}`;
  const picnic=item.id==='magic-toys-picnic';ko=picnic?'내 소풍 실험실 열기':'내 마법 실험실 열기';en=picnic?'Play with my picnic toys':'Open my magic playground';image=picnic?'/try/word-magic/assets/objects/bear.webp':shopArt.magic[1];
 }else if(id==='order'){
  item=owned.find(i=>i.id==='order-playset-picnic');href=item?'/try/order-rush/beginner.html?play=picnic':'/try/order-rush/beginner.html';ko=item?'친구들과 소풍하기':'내 가게에서 놀기';en=item?'Play my picnic':'Play in my shop';image=item?'/try/order-rush/beginner-assets/picnic/rolled-mat.webp':shopArt.order[1];
 }else{
  item=owned.find(i=>i.id==='ship-keepsake-starbook');href=item?'/try/spaceship-coop/?collection=starbook':'/try/spaceship-coop/';ko=item?'내 탐험 별지도 열기':'내 우주선으로 탐험하기';en=item?'Open my expedition starbook':'Explore with my ship';image=item?shopArt.ship[1]:shopArt.ship[0];
 }
 link.href=href;link.dataset.ownedPlay=item?.id||id;link.querySelector('b').textContent=ko;link.querySelector('[lang=en]').textContent=en;link.querySelector('img').src=image;
}
let beginnerShopRevision=0;
async function updateBeginnerShops(){
 const revision=++beginnerShopRevision;
 const states=await Promise.all(beginnerShops.map(row=>SynkPlayCollection.beginnerProgress(row[6])));
 if(revision!==beginnerShopRevision)return;
 beginnerShops.forEach(([id,,,,,,,kinds],index)=>{
  const state=states[index],items=state.items.filter(item=>kinds.includes(item.kind)&&item.price>0),count=items.filter(item=>item.owned).length;
  const card=document.querySelector(`[data-beginner-shop="${id}"]`),goal=state.goal;
  card.querySelector('.shop-owned').textContent=state.available?`모은 물건 ${count}/${items.length} · Collected ${count}/${items.length}`:'저장을 사용할 수 없어요 · Storage unavailable';
  const status=card.querySelector('.shop-goal');status.replaceChildren();
  const line=document.createElement('span'),translation=document.createElement('span');translation.lang='en';
  line.textContent=!state.available?'':!goal?(count?'내가 모은 놀이가 기다리고 있어요.':'어떤 놀이를 갖고 싶나요?'):`${goal.name} · ${state.owned?'목표 달성! 바로 써 보세요':state.affordable?'이제 살 수 있어요':`${state.remaining}코인 더 모으면 돼요`}`;
  translation.textContent=!state.available?'':!goal?(count?'Your play things are ready whenever you are.':'Choose something to play with.'):`${goal.nameEn} · ${state.owned?'Yours! Ready to use.':state.affordable?'Ready to buy.':`${state.remaining} more coins to go.`}`;
  status.append(line,translation);status.hidden=!state.available;
  updateOwnedPlay(card,id,state);
 });
}
updateBeginnerShops();addEventListener('synk:collection-change',updateBeginnerShops);addEventListener('pageshow',updateBeginnerShops);addEventListener('focus',updateBeginnerShops);
for(const [game,name,description,path,art,journey,anchor] of gameList){
  const card=document.createElement('article');card.className='collection-game';card.dataset.game=game;
  card.innerHTML=`<div class="collection-game-heading"><img src="./assets/progress/${art}.webp" alt=""><div><h2>${name}</h2><p>${description}</p><span data-play-title="${game}" hidden></span></div></div><p class="collection-journey">${journey}</p><p class="collection-owned" role="status">나의 진행을 불러오고 있어요.</p><a class="play-felt-button collection-play" href="/try/${PUBLIC_GAME_SLUGS[path]||path}/${anchor?'#'+anchor:''}">이어서 플레이 →</a><details class="play-common-extras"><summary>상점과 공통 컬렉션</summary><div class="collection-goal"></div></details>`;
  document.getElementById('collection-games').append(card);
  SynkPlayProgress.mount({game,home:card.querySelector('.collection-goal'),...(game==='racing'||game==='runner'?{nativeShop:()=>{location.href=`/try/${PUBLIC_GAME_SLUGS[path]||path}/?${game==='racing'?'garage':'shop'}=1`;},nativeShopLabel:game==='racing'?'나의 차고':'바람상점',nativeShopDescription:description+'. 게임에서 미리 보고 골라요.'}:{})});
}
let summaryRevision=0;
async function updateSummary(){
 const revision=++summaryRevision;
 const states=await Promise.all(gameList.map(([game])=>SynkPlayCollection.progress(game)));
 if(revision!==summaryRevision)return;
 const available=states.every(state=>state.available);
 document.getElementById('wallet').textContent=available?`${states[0].coins} 코인`:'코인 확인 필요';
 document.getElementById('collection-summary').textContent=available?`모은 칭호 ${states.reduce((sum,state)=>sum+state.achievements.filter(a=>a.unlocked).length,0)} / 28 · 일곱 게임의 기록이 차곡차곡`:'컬렉션 기록을 읽지 못했어요. 저장 연결을 확인한 뒤 이 화면으로 돌아오면 다시 확인해요.';
}
updateSummary();addEventListener('synk:collection-change',updateSummary);addEventListener('pageshow',updateSummary);addEventListener('focus',updateSummary);

// Use the canonical shared ledger. Optional journey modules are not shipped here.
async function updateJourneys(){
 await Promise.allSettled(gameList.map(async([game])=>{
  const target=document.querySelector(`[data-game="${game}"] .collection-owned`);
  try{
   const current=await SynkPlayCollection.progress(game);
   target.textContent=!current.available?'이 브라우저에서 기록을 읽을 수 없어요.':current.stats.rounds?`완료 ${current.stats.rounds}판 · 모은 칭호 ${current.achievements.filter(a=>a.unlocked).length}/${current.achievements.length}`:'첫 한 판을 마치고 나의 기록을 남겨 보세요.';
  }catch{target.textContent='게임에서 나의 진행을 확인해 주세요.';}
 }));
}
updateJourneys();addEventListener('synk:collection-change',updateJourneys);addEventListener('focus',updateJourneys);addEventListener('storage',updateJourneys);
