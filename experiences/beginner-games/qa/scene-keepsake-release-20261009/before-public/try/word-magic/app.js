import {SPELLS,CHAPTERS,PUZZLES,LAB_SETS} from './content.js';
import {clone,SAVE_KEY,initialProgress,restoreProgress,restoreResume,tutorialObject,unlockedChapter,availableSpells,transform,isSolved,complete,nextUnfinished,solution,checkpointRound,checkpointView,checkAnswer} from './core.js';
import {VoiceBank} from './audio.js';
import {MagicStage} from './stage.js';
import {MagicLearning} from './learning.js';
import {MagicShop} from './shop.js';
import {collectPractice,practiceStatus} from './practice.js';

// Restore the verified account before reading progress or enabling play.
await globalThis.SynkPlayAccount.ready();
const progressStorage = globalThis.SynkPlayAccount.storage();
const $=q=>document.querySelector(q),el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text)n.textContent=text;return n;};
let storage;try{storage=localStorage;}catch{}
let saved;try{saved=restoreProgress(progressStorage.getItem(SAVE_KEY));}catch{saved=initialProgress();}
const voice=new VoiceBank(),learning=new MagicLearning(globalThis.SynkLearning,storage);
const state={screen:'lobby',progress:saved,preview:false,sceneIndex:0,objects:[],selected:null,spell:null,busy:false,solved:false,tutorSeen:[],check:null,checkRound:[],heard:false,help:false,attempt:0,checkIndex:0,token:0,photoURL:null,assetReady:false,focusTarget:null,interrupted:null};
const stage=new MagicStage($('#stage'),$('#objects'),selectObject);
const heroStage=new MagicStage($('#hero-stage'),document.createElement('div'),()=>{});
const say=(en,ko)=>state.progress.language==='ko'?ko:en;
const query=new URLSearchParams(location.search),launch={requested:query.get('play')==='lab'&&query.get('shop')!=='1',itemId:query.get('item'),checked:false,dismissed:false,busy:false,error:''};
Object.assign(state,{pendingLab:false,labSet:'default',labHeardSpell:null,practiceActions:[],practicePending:false,practiceResult:null});
const shop=new MagicShop({say,onApply:applyShop,onUse:usePurchase,onProgress:renderMotivation,onOpen:()=>{stop();remember();if(state.screen!=='lobby')render();}});
let chapterReward=null;
const labels={rabbit:'Rabbit · 토끼',bear:'Bear · 곰',fox:'Fox · 여우',penguin:'Penguin · 펭귄',book:'Book · 책',camera:'Camera · 사진기',chair:'Chair · 의자',purse:'Bag · 가방',chest:'Chest · 상자',door:'Door · 문','swim-ring':'Swimming ring · 튜브','water-bottle':'Water bottle · 물병',umbrella:'Umbrella · 우산',snack:'Snack · 간식'};
const icons={grow:'<path d="M10 32h12v12H10zM32 10h22v22H32zM20 26l9-9m-8 0h8v8"/>',shrink:'<path d="M8 8h24v24H8zM43 43h12v12H43zM32 37l9 9m-8 0h8v-8"/>',open:'<path d="M14 8h34v48H14zM14 8l19 8v34l-19 6M40 29h1"/>',close:'<path d="M14 8h34v48H14zM40 29h1M6 32h18m-6-6 6 6-6 6"/>',up:'<path d="M32 51V13m-15 15 15-15 15 15M12 7h40"/>',down:'<path d="M32 13v38m-15-15 15 15 15-15M12 57h40"/>'};
function icon(id){return `<svg viewBox="0 0 64 64" aria-hidden="true">${icons[id]}</svg>`;}
function announce(text){$('#sr-live').textContent=text;}
function persist(){if(state.preview)return;saved=clone(state.progress);try{progressStorage.setItem(SAVE_KEY,JSON.stringify(state.progress));$('#save-status').textContent=globalThis.SynkPlayAccount.status().mode==='account'?say('Account save status is shown above','계정 저장 상태는 화면 위에서 확인해요'):say('Progress saved on this browser','이 브라우저에 진행을 저장했어요');}catch{$('#save-status').textContent=say('Progress lasts for this visit','이번 방문 동안 진행 유지');}}
function feedback(en,ko){$('#feedback').textContent=say(en,ko);announce(say(en,ko));}
function freshPracticeDay(){const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());if(state.practiceDay===day)return;const previous=state.practiceDay;state.practiceDay=day;state.practiceActions=[];state.practiceResult=null;state.labHeardSpell=null;if(previous)shop.refresh();}
function stop(){state.token++;voice.stop();state.busy=false;state.labHeardSpell=null;}
function saveLab(){state.progress.labs[state.labSet]=clone(state.objects);if(state.labSet==='default')state.progress.lab=clone(state.objects);state.progress.labSet=state.labSet;persist();}
function applyShop(look){stage.appearance(look);const next=Object.hasOwn(LAB_SETS,look.toys)?look.toys:'default';if(next===state.labSet)return;if(state.screen==='lab')saveLab();state.labSet=next;if(state.screen==='lab'){stop();state.objects=clone(state.progress.labs[next]);state.selected=null;state.spell=null;remember();render();}}
async function usePurchase(item){
 if(state.busy||shop.busy)return false;const preparing=voice.prepare();shop.busy=true;state.busy=true;
 try{await Promise.all([assets,preparing]);if(item){const r=await globalThis.SynkPlayCollection.equip(item.id);if(!r.ok)throw Error('save');await shop.refresh();}shop.closeForPlay();if(state.preview){state.preview=false;state.progress=clone(saved);}if(state.screen==='lobby')state.progress=clone(saved);keepAdventure();state.busy=false;if(state.progress.introduced.length)openLab();else await begin(0,false,false,true);return state.screen==='lab'||state.screen==='tutorial';}
 catch{const message=say('Could not start the playground. Check sound and browser storage, then try again.','실험실을 열지 못했어요. 소리와 브라우저 저장을 확인한 뒤 다시 시도해 주세요.');if(shop.dialog.open){shop.message=message;shop.render();}else{$('#audio-status').textContent=message;$('#motivation-status').textContent=message;}return false;}
 finally{state.busy=false;shop.busy=false;if(shop.dialog.open)shop.render();}
}
function renderMotivation(){
 freshPracticeDay();
 renderLaunch();
 const lab=state.screen==='lab',shown=lab||state.screen==='ending';if(!shop.dialog.open)$('#motivation-status').textContent=shop.message;$('#game-goal').hidden=!shown;$('#lab-practice').hidden=!lab;if(shown)shop.goalView($('#game-goal'));if(!lab)return;
 const p=practiceStatus(state.practiceActions),r=state.practiceResult,claimed=shop.progress?.practiceClaimed;
 $('#practice-title').textContent=say('A little daily experiment · +5 coins','오늘의 작은 실험 · +5코인');$('#practice-copy').textContent=say('Hear your words. Make 3 different changes using at least 2 words and 2 objects. Once a day, in either playground.','소리를 듣고 두 말·두 물건으로 서로 다른 변화 3번을 만들어요. 어느 실험실에서든 하루 한 번 받을 수 있어요.');
 $('#practice-status').textContent=state.preview?say('Picture preview · no practice coins','그림 체험에서는 복습 코인을 지급하지 않아요'):state.practicePending?say('Saving your experiment…','실험을 저장하고 있어요…'):r?.saved&&r.coins>0?say('You played with your words · +5 shared coins!','배운 말로 놀았어요 · 공통 코인 +5개!'):claimed||r?.reason==='duplicate-round'?say('Today’s experiment coins are collected. Keep creating!','오늘의 실험 코인은 받았어요. 계속 마음껏 만들어요!'):r?.reason==='daily-limit'?say('Today’s shared coin limit is reached. Keep creating freely.','오늘의 공통 코인 한도에 도달했어요. 놀이는 계속할 수 있어요.'):r&&!r.saved?say('Your experiment is ready, but coins could not be saved. Try again.','실험은 완성했지만 코인을 저장하지 못했어요. 다시 시도해 주세요.'):say(`${Math.min(3,p.count)} / 3 changes · ${Math.min(2,p.words)} / 2 words · ${Math.min(2,p.objects)} / 2 objects`,`${Math.min(3,p.count)} / 3 변화 · ${Math.min(2,p.words)} / 2 표현 · ${Math.min(2,p.objects)} / 2 물건`);
 $('#practice-retry').hidden=state.preview||!r||r.saved||r.reason==='daily-limit'||claimed||state.practicePending;$('#practice-retry').textContent=say('Save my practice coins again','복습 코인 다시 저장');
}
async function awardPractice(retry=false){
 if(state.preview||state.screen!=='lab'||state.practicePending||shop.progress?.practiceClaimed||!practiceStatus(state.practiceActions).ready||state.practiceResult&&!retry)return;
 state.practicePending=true;renderMotivation();try{state.practiceResult=await globalThis.SynkPlayCollection.awardPractice({game:'word-magic',completed:true,preview:false,actions:clone(state.practiceActions)});}catch{state.practiceResult={saved:false,reason:'storage'};}state.practicePending=false;await shop.refresh();renderMotivation();
}
function keepAdventure(){const r=state.progress.resume;if(!state.preview&&!state.progress.adventureResume&&r&&['tutorial','puzzle','checkpoint'].includes(r.screen)&&!r.pendingLab){state.progress.adventureResume=clone(r);persist();}}
function remember(){if(state.preview||state.screen==='lobby')return;state.progress.resume=restoreResume(state,state.progress);persist();}
function renderLaunch(){
 const node=$('#lab-launch');node.hidden=!launch.requested||launch.dismissed||state.screen!=='lobby';if(node.hidden)return;
 const item=shop.items.find(x=>x.id===launch.itemId),owned=!!item&&shop.wallet?.owned.includes(item.id),valid=!launch.itemId||owned;
 $('#launch-eyebrow').textContent=say('FROM YOUR COLLECTION','내 보관함에서 이어서');$('#launch-title').textContent=!launch.checked?say('Getting your playground ready','실험실을 준비하고 있어요'):!shop.wallet?say('Your wallet is unavailable','보관함을 확인하지 못했어요'):valid?(item?shop.name(item):say('Your equipped playground','지금 장착한 실험실')):item?say('This item is not yours yet','아직 보유하지 않은 상품이에요'):say('This item link is unavailable','상품 링크를 확인해 주세요');
 $('#launch-copy').textContent=!launch.checked?say('Checking your saved items…','저장된 보유품을 확인하고 있어요…'):!shop.wallet?say('Try checking again, or return to the free adventure.','다시 확인하거나 무료 모험으로 돌아갈 수 있어요.'):!valid?say('Play with the free original toys, or see this item in the shop. Opening this link does not buy anything.','무료 기본 소품으로 놀거나 상점에서 상품을 볼 수 있어요. 링크를 여는 것만으로 구매되지는 않아요.'):state.progress.introduced.length?say('Tap to prepare the Korean sounds and enter. Your unfinished adventure will wait for you.','누르면 한국어 소리를 준비하고 들어가요. 하던 모험은 그대로 남겨 둘게요.'):say('First try two Korean words, then play with your toys. Tap when you are ready.','한국어 두 표현을 먼저 익힌 뒤 내 소품으로 놀아요. 준비되면 눌러 주세요.');
 const use=$('#launch-use');use.disabled=!launch.checked||launch.busy;use.textContent=launch.busy?say('Preparing sounds…','소리를 준비하고 있어요…'):!shop.wallet?say('Check my items again','보유품 다시 확인'):valid?say('Play with this','이 소품으로 놀기'):say('Play with the free toys','무료 기본으로 놀기');
 $('#launch-shop').textContent=say('See the shop','상점 보기');$('#launch-shop').disabled=launch.busy||!launch.checked;$('#launch-dismiss').textContent=say('Back to my adventure','모험 화면으로');$('#launch-dismiss').disabled=launch.busy;$('#launch-status').textContent=launch.error;
 $('#launch-image').src=item?.kind==='magic-toys'&&item.value==='picnic'?'assets/objects/bear.webp':'assets/objects/camera.webp';
}
async function launchPlay(){
 if(launch.busy)return;if(!shop.wallet){launch.busy=true;renderLaunch();await shop.refresh();launch.checked=true;launch.busy=false;renderLaunch();return;}
 const item=shop.items.find(x=>x.id===launch.itemId),owned=!!item&&shop.wallet.owned.includes(item.id),chosen=!launch.itemId?null:owned?item:shop.items.find(x=>x.id==='magic-toys-default');
 launch.busy=true;launch.error='';renderLaunch();const ok=await usePurchase(chosen);launch.busy=false;if(ok)launch.dismissed=true;else launch.error=say('The sounds or saved items could not be prepared. Check your connection and browser storage, then tap to try again.','소리나 보유품을 준비하지 못했어요. 연결과 브라우저 저장을 확인한 뒤 다시 눌러 주세요.');renderLaunch();
}
function sceneEntrance(){state.focusTarget=null;$('#scene-title').focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
function toggleScreens(game){$('#lobby').hidden=game;$('#game').hidden=!game;$('#preview-note').hidden=!state.preview;}
function showHome(){remember();stop();learning.abandon();if(state.preview){state.progress=clone(saved);state.preview=false;}state.screen='lobby';state.focusTarget=null;toggleScreens(false);renderHome();window.scrollTo({top:0,behavior:'instant'});$('#start').focus({preventScroll:true});}
function renderHome(){
 const p=state.progress,all=p.completed.length===PUZZLES.length;
 document.documentElement.lang=p.language;
 $('#hero-title').textContent=say('Word Magic','말의 마법사');$('#hero-subtitle').textContent=say('Two words. A little wonder.','두 표현으로 시작하는 작은 마법.');$('#hero-description').textContent=say('Hear a little Korean. Make tiny things big. A whole world is waiting for your touch.','한국어를 듣고 작은 물건을 크게 바꿔요. 손끝에서 새로운 이야기가 시작돼요.');$('#hero-caption').textContent=say('Listen first · No timer · Yours to explore','먼저 듣고 · 시간 제한 없이 · 마음껏 탐험');$('#hero-art-label').textContent=say('A world you can change.','내가 바꾸는 작은 세상.');
 $('#start').textContent=p.resume?.screen==='lab'&&p.adventureResume?say('Return to my adventure','하던 모험으로 돌아가기'):p.resume?say('Continue where I left off','하던 곳에서 이어 하기'):all?say('Play my adventure again','다시 모험하기'):p.completed.length?say('Continue my adventure','이어서 모험하기'):say('Start with two words','두 표현으로 시작');
 $('#preview').textContent=say('Explore with pictures','그림으로 체험');$('#journey-title').textContent=say('Three tiny adventures','세 개의 작은 모험');$('#progress-copy').textContent=say(`${p.completed.length} / 18 discoveries · untimed`,`${p.completed.length} / 18개 사건 · 시간 제한 없음`);
 $('#lab-title').textContent=say('Your magic playground','자유 실험실');$('#lab-description').textContent=say('Play with the words you have discovered. Keep a picture.','배운 말로 마음껏 놀고, 멋진 장면은 사진으로 남겨요.');$('#open-lab').textContent=say('Enter the playground','실험실 들어가기');$('#open-lab').disabled=!p.introduced.length;
 $('#learning-note').textContent=globalThis.SynkPlayAccount.status().mode==='account'?say('No timer. Your SYNK account keeps your progress across devices. Check the save status above.','시간 제한 없이, 한글을 몰라도 시작해요. 계정 진도를 다른 기기에서 이어갈 수 있어요. 저장 상태는 화면 위에서 확인해요.'):say('No timer. No reading Korean needed. Sign in with SYNK ID to keep your progress across devices.','시간 제한 없이, 한글을 몰라도 시작해요. SYNK ID로 연결하면 다른 기기에서 진행을 이어갈 수 있어요.');$('#reset').textContent=say('Reset my adventure','모험 진행 초기화');
 $('#shop-entry-title').textContent=say('Make the world your own','내 취향으로 바꾸는 작은 세상');$('#shop-entry-copy').textContent=say('Collect shared coins. Choose new toys, a backdrop and a photo frame.','공통 코인으로 새 소품과 장면 배경, 사진틀을 골라요.');shop.labels();
 const unlocked=unlockedChapter(p);$('#chapters').replaceChildren(...CHAPTERS.map((c,i)=>{const n=el('button','chapter-card');n.disabled=i>unlocked;n.dataset.chapter=i;n.innerHTML=`<span class="chapter-art"><img class="chapter-scenery" src="assets/scenes/${['village','theatre','terrace'][i]}.webp" alt=""><span class="chapter-number">0${i+1}</span><img class="chapter-prize" src="assets/objects/${c.prize}.webp" alt=""></span><span class="chapter-copy"><span class="chapter-count">${PUZZLES.filter(x=>x.chapter===i&&p.completed.includes(x.id)).length} / 6</span><strong></strong><small></small></span>`;n.querySelector('strong').textContent=say(c.en,c.ko);n.querySelector('small').textContent=i>unlocked?say('Finish the previous adventure','앞 모험을 마치면 열려요'):say('6 little discoveries →','작은 사건 6개 →');n.onclick=()=>begin(i*6,false);return n;}));
 $('#language').textContent=p.language==='ko'?'English':'한국어';renderLaunch();
}
async function begin(index,preview,resume=false,playground=false){
 if(state.busy)return;state.busy=true;$('#start').disabled=true;$('#audio-status').textContent=say('Preparing your adventure…','모험을 준비하고 있어요…');
 try{await Promise.all([assets,preview?Promise.resolve():voice.prepare()]);}
 catch(error){$('#audio-status').textContent=state.assetReady?say('Korean voice is not ready yet. Try again, or explore with pictures.','한국어 소리를 아직 준비하지 못했어요. 다시 시도하거나 그림으로 체험할 수 있어요.'):say('Could not load the scene. Check your connection and try again.','장면을 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.');$('#start').disabled=false;state.busy=false;return;}
 $('#audio-status').textContent='';$('#start').disabled=false;state.busy=false;state.preview=preview;state.pendingLab=playground;state.progress=preview?initialProgress():clone(saved);if(preview)state.progress.language=saved.language;state.sceneIndex=index;toggleScreens(true);const returning=state.progress.resume?.screen==='lab'&&state.progress.adventureResume,snapshot=returning||state.progress.resume;if(!preview&&resume&&snapshot){if(returning)state.progress.adventureResume=null;restoreScene(snapshot);remember();}else enterScene(index);
}
function restoreScene(snapshot){
 stop();learning.abandon();const r=restoreResume(snapshot,state.progress);if(!r){enterScene(nextUnfinished(state.progress));return;}
 Object.assign(state,r);state.focusTarget=null;state.heard=false;state.help=false;state.solved=state.screen==='puzzle'?isSolved(PUZZLES[state.sceneIndex],state.objects):state.screen==='checkpoint'&&state.attempt>0&&state.spell===state.check.spell;
 if(state.screen==='ending'){showEnding();return;}if(state.screen==='lab'){openLab();return;}
 if(state.screen==='checkpoint'&&state.attempt===0){learning.present(state.check);state.help=true;learning.help('hint');}
 render();sceneEntrance();if(state.screen==='checkpoint'&&!state.solved)feedback('Your check is ready. Listen again before choosing.','이어서 확인할 차례예요. 다시 듣고 골라 주세요.');else feedback('Your scene is just as you left it.','바꾸던 장면을 그대로 이어 왔어요.');
}
function enterScene(index){
 if(!state.pendingLab)state.progress.adventureResume=null;
 stop();learning.abandon();state.focusTarget=null;state.sceneIndex=Math.max(0,Math.min(17,index));const scene=PUZZLES[state.sceneIndex],c=CHAPTERS[scene.chapter];
 if(!state.progress.introduced.includes(c.id)){state.screen='tutorial';state.tutorSeen=[];state.objects=[tutorialObject(scene.chapter)];state.spell=null;state.selected='teacher';state.solved=false;remember();render();sceneEntrance();return;}
 state.screen='puzzle';state.objects=clone(scene.objects);state.spell=null;state.selected=null;state.solved=false;state.progress.last=state.sceneIndex;remember();render();sceneEntrance();feedback('First choose a word below, then touch a numbered object.','아래 마법을 먼저 고르고, 번호가 붙은 물건을 눌러요.');
}
function chapter(){return CHAPTERS[PUZZLES[state.sceneIndex].chapter];}
function render(){
 const active=document.activeElement;if(!state.focusTarget&&active?.dataset.spell)state.focusTarget={kind:'spell',id:active.dataset.spell};else if(!state.focusTarget&&active?.dataset.object)state.focusTarget={kind:'object',id:active.dataset.object};
 const mode=state.screen,c=chapter(),scene=PUZZLES[state.sceneIndex];$('#home').textContent=say('Pause','잠깐');$('#help').textContent=say('Help','도움');$('#replay').textContent=say('Listen again','다시 듣기');$('#preview-note').textContent=say('Picture preview · no listening record or saved learning progress','그림 체험 · 듣기 기록과 정식 진행을 저장하지 않아요');
 $('#game').dataset.mode=mode;
 $('#chapter-label').textContent=mode==='lab'?'FREE PLAY':`${String(scene.chapter+1).padStart(2,'0')} · ${say(c.en,c.ko)}`;
 $('#scene-title').textContent=mode==='tutorial'?(state.pendingLab?say('Two words for your playground','실험실에서 쓸 두 표현'):say('Meet your two magic words','두 마법을 먼저 만나요')):mode==='lab'?say(LAB_SETS[state.labSet].en,LAB_SETS[state.labSet].ko):mode==='checkpoint'?say('A little listening discovery','소리로 한 번 더'):mode==='ending'?say(c.rewardEn,c.reward):say(scene.en,scene.title);
 $('#scene-story').textContent=mode==='tutorial'?(state.pendingLab?say('Try both words, then play with your chosen toys.','두 표현을 익히면 고른 소품으로 바로 놀 수 있어요.'):say('Touch each sound. Watch what changes.','소리를 하나씩 누르고, 변화를 살펴봐요.')):mode==='lab'?say('Try any word on any object. What happens?','어떤 물건에 어떤 말을 써 볼까요?'):mode==='checkpoint'?say('Listen, then choose the change you heard.','듣고, 소리에 맞는 변화를 골라요.'):mode==='ending'?say('You changed this little world with Korean.','한국어로 작은 세상을 바꿨어요.'):say(scene.storyEn,scene.story);
 $('#scene-subtitle').textContent=mode==='puzzle'?`${state.sceneIndex%6+1} / 6`:mode==='tutorial'?say('We learn before we solve.','문제를 풀기 전에 같이 배워요.'):mode==='lab'?say('No right answer. Your experiment, your scene.','정답 없는 놀이. 마음대로 실험해요.'):mode==='checkpoint'?`${state.checkIndex+1} / 2`:say('Take a breath. Your adventure can wait.','잠깐 쉬어도 좋아요. 모험은 기다려요.');
 $('#goal-view').hidden=mode!=='puzzle';$('#goal-label').textContent=say('Your goal','완성 모습');if(mode==='puzzle')stage.goal($('#goal-canvas'),scene);
 $('#instruction').textContent=mode==='tutorial'?say(`Touch both words · ${state.tutorSeen.length} / 2 tried`,`두 마법을 눌러 봐요 · ${state.tutorSeen.length} / 2`):mode==='checkpoint'?say('Which change did you hear?','어떤 변화를 들었나요?'):mode==='ending'?say('A new discovery for your playground','실험실에서 쓸 새 마법이 생겼어요'):state.spell?say('2. Touch a numbered object in the scene','2. 장면의 번호 붙은 물건 누르기'):say('1. Choose a magic word below','1. 아래에서 마법 먼저 고르기');
 $('#replay').hidden=mode==='ending'||state.preview;$('#replay').disabled=state.busy||(!state.spell&&mode!=='checkpoint');
 $('#lab-tools').hidden=mode!=='lab';$('#photo').textContent=say('Save a picture','사진 저장');$('#lab-reset').textContent=say('Reset the scene','장면 처음으로');
 $('#resume-adventure').hidden=mode!=='lab'||!state.progress.adventureResume;$('#resume-adventure').textContent=say('Return to my adventure','하던 모험으로 돌아가기');
 $('#next').hidden=!(mode==='ending'||state.solved||mode==='tutorial'&&state.tutorSeen.length===2);$('#next').disabled=state.busy;
 $('#next').textContent=mode==='ending'?(scene.chapter===2?say('Enter the playground','실험실에서 놀기'):say('Next adventure','다음 모험')):mode==='tutorial'?(state.pendingLab?say('Play with my toys','내 소품으로 놀기'):say('Try the adventure','모험 시작')):mode==='checkpoint'?say('Continue','계속'):say('Next discovery','다음 사건');
 $('#keyboard-help').textContent=say('A / S: magic · 1–4: objects · R: replay · Esc: pause','A / S: 마법 · 1–4: 물건 · R: 다시 듣기 · Esc: 잠깐');
 const checkView=mode==='checkpoint'?checkpointView(state.check,{answered:state.attempt>0,objects:state.objects}):null;
 const ids=checkView?checkView.choices.map(x=>x.id):mode==='lab'?availableSpells(state.progress):mode==='ending'?[]:c.pair;
 $('#spells').replaceChildren(...ids.map((id,i)=>{const b=el('button',`spell${mode==='checkpoint'?' check-spell':''}`),choice=checkView?.choices.find(x=>x.id===id);b.dataset.spell=id;b.disabled=state.busy||state.solved&&mode==='checkpoint';b.setAttribute('aria-pressed',String(state.spell===id));b.setAttribute('aria-label',choice?choice.label+(choice.korean?` · ${choice.korean}`:''):`${SPELLS[id].ko} · ${SPELLS[id].en}`);b.innerHTML=`<span class="key">${['A','S','D','F','G','H'][i]}</span>${icon(id)}${mode==='tutorial'&&state.tutorSeen.includes(id)?'<span class="learned-mark" aria-hidden="true"></span>':''}${choice?`<span>${choice.korean?`<span class="word">${choice.korean}</span>`:''}<span class="meaning">${choice.label}</span></span>`:`<span><span class="word">${SPELLS[id].ko}</span><span class="meaning">${say(SPELLS[id].en,'')}</span></span>`}`;b.onclick=()=>chooseSpell(id);return b;}));
 // The prompt scene stays neutral until a first answer: no reverse-state clue or goal.
 stage.set(checkView?checkView.objects:state.objects,{chapter:mode==='lab'?0:scene.chapter,selected:checkView&&!checkView.reveal?null:state.selected,solved:state.solved||mode==='ending',labels,animate:true,scene:mode==='puzzle'?scene:null});
 if(!['puzzle','lab'].includes(mode))$('#objects').replaceChildren();
 $('#after-game-links').hidden=!['ending','lab'].includes(mode);$('#ending-lab').hidden=mode==='lab'||scene.chapter===2;$('#ending-lab').textContent=say('Play with my words','배운 말로 자유롭게 놀기');$('#other-games').textContent=say('Explore other games','다른 놀이 둘러보기');
 $('#chapter-coins').hidden=mode!=='ending';if(mode==='ending')renderReward();shop.labels();
 $('#scene-state').textContent=state.solved&&mode==='puzzle'?say(scene.endingEn,scene.ending):mode==='checkpoint'&&state.solved?say('That is the magic you heard!','소리를 듣고 해냈어요!'):'';
 if(mode==='tutorial')feedback('Two words can change everything. Try both.','두 표현이 세상을 바꿔요. 둘 다 눌러 보세요.');else if(mode==='lab')feedback(LAB_SETS[state.labSet].ideaEn,LAB_SETS[state.labSet].ideaKo);renderMotivation();
 if(!state.busy&&!document.querySelector('dialog[open]')&&state.focusTarget){const f=document.querySelector(`[data-${state.focusTarget.kind}="${state.focusTarget.id}"]`);if(f&&!f.disabled)f.focus({preventScroll:true});state.focusTarget=null;}
}
async function play(id){if(state.preview)return true;return voice.play(id);}
async function chooseSpell(id){
 freshPracticeDay();
 if(state.busy||!SPELLS[id])return;if(state.screen==='checkpoint'){await respond(id);return;}if(state.screen==='ending')return;
 const mode=state.screen;state.labHeardSpell=null;state.spell=id;state.focusTarget={kind:'spell',id};state.busy=true;const token=state.token;
 if(mode==='tutorial'){const s=SPELLS[id];state.objects=state.objects.map(o=>({...o,[s.property]:s.property==='size'?(s.value===1.55?.62:1.55):s.property==='open'?!s.value:1-s.value}));}
 render();const ok=await play(id);if(token!==state.token)return;state.busy=false;
 if(!ok){render();feedback('The sound did not finish. Tap the word to try again.','소리를 끝까지 듣지 못했어요. 표현을 다시 눌러 주세요.');return;}
 if(mode==='lab'&&!state.preview)state.labHeardSpell=id;
 if(mode==='tutorial'){
  state.objects=transform(state.objects,'teacher',id).objects;state.tutorSeen=[...new Set([...state.tutorSeen,id])];if(state.tutorSeen.length===2)state.progress.introduced=[...new Set([...state.progress.introduced,chapter().id])];remember();render();feedback(`${SPELLS[id].ko} — ${SPELLS[id].en}. ${state.tutorSeen.length===2?'Your two words are ready!':'Now try the other word.'}`,`${SPELLS[id].ko}! ${state.tutorSeen.length===2?'두 마법을 배웠어요.':'이번에는 다른 마법도 눌러 봐요.'}`);
 }else{remember();render();feedback(`Now touch an object. ${SPELLS[id].ko}!`,'이제 바꾸고 싶은 물건을 눌러요.');}
}
function selectObject(id){
 freshPracticeDay();
 if(state.busy||state.screen==='checkpoint'||state.screen==='ending'||state.screen==='tutorial')return;state.selected=id;state.focusTarget={kind:'object',id};
 if(!state.spell){render();feedback('First choose a magic word below.','아래에서 마법을 먼저 골라 주세요.');return;}
 const r=transform(state.objects,id,state.spell);state.objects=r.objects;
 if(state.screen==='puzzle')state.solved=isSolved(PUZZLES[state.sceneIndex],state.objects);
 if(state.screen==='lab'){saveLab();state.practiceActions=collectPractice(state.practiceActions,{set:state.labSet,spell:state.spell,objectId:id,heard:state.labHeardSpell===state.spell&&!state.preview,changed:r.changed});}
 if(state.solved){state.progress=complete(state.progress,PUZZLES[state.sceneIndex]);persist();voice.tone(true);}else if(r.changed)voice.tone();
 remember();render();if(r.unsupported)feedback('This object has no lid or door. Try a book or chest.','이 물건에는 여닫을 곳이 없어요. 책이나 상자에 써 봐요.');else if(!r.changed)feedback('It is already like that. Try the other magic.','이미 그렇게 되어 있어요. 다른 마법도 써 봐요.');else if(state.solved)feedback('You did it! Explore a little more, or continue.','해냈어요! 조금 더 만져 보거나 다음으로 가요.');else feedback(`${SPELLS[state.spell].ko}! What else could change?`,`${SPELLS[state.spell].ko}! 또 무엇을 바꿔 볼까요?`);if(state.screen==='lab')awardPractice();
}
function goNext(){
 if(state.busy)return;
 if(state.screen==='tutorial'&&state.tutorSeen.length===2){if(state.pendingLab)openLab();else enterScene(state.sceneIndex);return;}
 if(state.screen==='puzzle'&&state.solved){if(state.sceneIndex%6===5){if(state.preview)showEnding();else startCheck(0);}else enterScene(state.sceneIndex+1);return;}
 if(state.screen==='checkpoint'&&state.solved){if(state.checkIndex===0)startCheck(1);else showEnding();return;}
 if(state.screen==='ending'){if(PUZZLES[state.sceneIndex].chapter===2)openLab();else enterScene(state.sceneIndex+1);}
}
async function startCheck(index){
 stop();learning.abandon();state.focusTarget=null;state.screen='checkpoint';state.checkIndex=index;if(index===0)state.checkRound=checkpointRound(PUZZLES[state.sceneIndex].chapter);state.check=clone(state.checkRound[index]);state.objects=[clone(state.check.object)];state.selected=state.check.object.id;state.solved=false;state.spell=null;state.heard=false;state.help=false;state.attempt=0;learning.present(state.check);remember();render();sceneEntrance();await replay();
}
async function replay(){
 if(state.preview||state.busy)return;const id=state.screen==='checkpoint'?state.check.spell:state.spell;if(!id)return;
 state.labHeardSpell=null;if(state.screen==='checkpoint'&&state.heard){state.help=true;learning.help('replay');}state.busy=true;const token=state.token;render();const ok=await voice.play(id);if(token!==state.token)return;state.busy=false;
 if(state.screen==='checkpoint'){learning.delivery(ok);if(ok)state.heard=true;}else if(state.screen==='lab'&&ok)state.labHeardSpell=id;render();feedback(ok?'Choose the change you heard.':'Sound stopped before the end. Please try again.',ok?'들린 말에 맞는 변화를 골라요.':'소리가 끝나기 전에 멈췄어요. 다시 들어 주세요.');
}
async function respond(id){
 if(state.solved||state.busy||!state.heard){feedback('Listen to the whole word first.','먼저 소리를 끝까지 들어 주세요.');return;}
 const result=checkAnswer(state.check,id,{heard:state.heard,help:state.help,attempt:state.attempt});
 if(state.attempt===0){learning.answer(result.correct);state.progress.checks.push({...result,at:new Date().toISOString(),id:state.check.id});persist();}
 state.attempt++;state.objects=transform(state.objects,state.check.object.id,id).objects;state.spell=id;state.solved=result.correct;
 if(!result.correct){state.help=true;learning.help('hint');}remember();render();
 feedback(result.correct?'You understood the word. Well discovered!':'That made a different change. Listen once more and try the other magic.',result.correct?'소리의 뜻을 알아냈어요!':'다른 변화가 일어났네요. 다시 듣고 다른 마법을 써 봐요.');if(result.correct){voice.tone(true);$('#next').focus({preventScroll:true});}
}
function showEnding(){stop();learning.abandon();state.focusTarget=null;state.screen='ending';state.solved=false;state.objects=[{id:'prize',asset:chapter().prize,x:475,y:345,size:1.55,open:false,level:0},{id:'friend',asset:'rabbit',x:720,y:377,size:.62,open:false,level:0}];remember();render();sceneEntrance();feedback('Keep playing with your words, or discover another game.','배운 말로 더 놀거나, 다른 놀이를 만나 보세요.');awardChapter();}
async function awardChapter(){
 const c=chapter(),chapterIndex=PUZZLES[state.sceneIndex].chapter;chapterReward=null;$('#chapter-coins').textContent='';
 if(state.preview){renderReward();return;}
 if(!PUZZLES.filter(p=>p.chapter===chapterIndex).every(p=>state.progress.completed.includes(p.id))||!c.pair.every(spell=>state.progress.checks.some(q=>q.spell===spell)))return;
 const result=await globalThis.SynkPlayCollection?.award({game:'word-magic',correct:0,total:6,completed:true,roundId:`word-magic:chapter:${c.id}`});
 await shop.refresh();if(state.screen!=='ending'||chapter().id!==c.id)return;chapterReward={id:c.id,result};renderReward();
}
function renderReward(){
 if(state.preview){$('#chapter-coins').textContent=say('Picture previews do not earn coins.','그림 체험에서는 코인을 지급하지 않아요.');return;}if(chapterReward?.id!==chapter().id){$('#chapter-coins').textContent='';return;}const result=chapterReward.result;
 $('#chapter-coins').textContent=result?.saved&&result.coins>0?say(`Adventure finished · +${result.coins} shared coins`,`모험 완주 · 공통 코인 +${result.coins}개`):result?.reason==='duplicate-round'?say('You already collected this adventure’s completion coins.','이 모험의 완주 코인은 이미 받았어요.'):result?.reason==='daily-limit'?say('Today’s shared completion coin limit is reached. Keep playing freely.','오늘의 공통 완주 코인 한도에 도달했어요. 놀이는 계속할 수 있어요.'):say('Could not save the coins. Allow browser storage and reopen this ending to retry.','코인을 저장하지 못했어요. 브라우저 저장을 허용한 뒤 이 완료 화면을 다시 열어 주세요.');
}
function openLab(){
 stop();learning.abandon();if(!state.progress.introduced.length)return;keepAdventure();state.focusTarget=null;state.screen='lab';state.pendingLab=false;state.labSet=Object.hasOwn(LAB_SETS,shop.look.toys)?shop.look.toys:'default';state.objects=clone(state.progress.labs[state.labSet]);state.spell=null;state.selected=null;state.solved=false;toggleScreens(true);remember();render();sceneEntrance();
}
function interruptSound(){state.interrupted=state.busy?(state.screen==='checkpoint'?state.check.spell:state.spell):null;stop();remember();}
function continueSound(dialog){dialog.close();const interrupted=state.interrupted;state.interrupted=null;render();if(interrupted){if(state.screen==='checkpoint')replay();else chooseSpell(interrupted);}}
function showPause(){
 if(state.screen==='lobby'||document.querySelector('dialog[open]'))return;interruptSound();
 $('#pause-title').textContent=say('A little break','잠깐 쉬어 가요');$('#pause-copy').textContent=say('Your scene will wait here. Continue when you are ready.','바꾸던 장면은 그대로예요. 준비되면 이어 해요.');
 $('#resume-game').textContent=state.interrupted?say('Continue and hear again','이어서 다시 듣기'):say('Continue','이어서 하기');$('#pause-home').textContent=say('Save and return home','저장하고 처음으로');$('#pause-games').textContent=say('Explore other games','다른 놀이 둘러보기');$('#pause-dialog').showModal();
}
function showHelp(){
 interruptSound();if(state.screen==='checkpoint'){state.help=true;learning.help('hint');}
 $('#help-title').textContent=say('A little magic','마법 쓰는 방법');$('#help-copy').replaceChildren();
 const lines=state.screen==='checkpoint'?[say('Listen to the whole word. Choose the picture showing that change.','소리를 끝까지 듣고, 그 변화가 그려진 단추를 골라요.'),say('You can always listen again. Assisted answers are kept separate.','언제든 다시 들어도 돼요. 도움을 받은 답은 별도로 남아요.')]:[say('Touch a word to hear it. Then touch an object to change it.','표현을 눌러 듣고, 물건을 누르면 마법이 생겨요.'),say('The small picture above the scene shows your goal. Change one or two objects to match it.','장면 위의 작은 그림이 목표예요. 한두 물건을 바꿔 맞춰 봐요.'),say('Nothing is lost if you try something else. You can undo a change with the other word.','다른 물건에 써도 괜찮아요. 반대 표현으로 다시 바꿀 수 있어요.')];for(const t of lines)$('#help-copy').append(el('p','',t));
 $('#show-hint').hidden=!['puzzle','checkpoint'].includes(state.screen);$('#show-hint').textContent=say('Show me a hint','힌트 보기');$('#close-help').textContent=state.interrupted?say('Back and hear again','돌아가서 다시 듣기'):say('Back to the adventure','다시 모험하기');$('#help-dialog').showModal();
}
function hint(){
 if(state.screen==='checkpoint'){state.help=true;learning.help('text');$('#help-copy').append(el('p','',`${SPELLS[state.check.spell].ko} = ${SPELLS[state.check.spell].en}`));return;}
 const scene=PUZZLES[state.sceneIndex],todo=solution(scene).find(a=>!scene.goals.filter(g=>g.id===a.objectId).every(g=>state.objects.find(o=>o.id===g.id)[g.property]===g.value));if(!todo)return;
 $('#help-copy').append(el('p','',`${labels[scene.objects.find(o=>o.id===todo.objectId).asset]} → ${SPELLS[todo.spell].ko} (${SPELLS[todo.spell].en})`));state.selected=todo.objectId;render();
}
async function photo(){
 const blob=await stage.photo();if(!blob){feedback('Could not make the picture. Please try again.','사진을 만들지 못했어요. 다시 시도해 주세요.');return;}
 if(state.photoURL)URL.revokeObjectURL(state.photoURL);state.photoURL=URL.createObjectURL(blob);$('#photo-preview').src=state.photoURL;$('#photo-download').href=state.photoURL;$('#photo-title').textContent=say('Your magic moment','내가 만든 마법의 순간');$('#photo-download').textContent=say('Download PNG','PNG 사진 내려받기');$('#close-photo').textContent=say('Back to playing','계속 놀기');$('#photo-dialog').showModal();
}
$('#start').onclick=()=>begin(nextUnfinished(saved),false,true);$('#preview').onclick=()=>begin(0,true);$('#home').onclick=showPause;$('#next').onclick=goNext;$('#replay').onclick=replay;$('#open-lab').onclick=async()=>{try{await Promise.all([assets,voice.prepare()]);state.progress=clone(saved);openLab();}catch{$('#audio-status').textContent=say('Voice is not ready yet. The picture adventure has its own playground.','소리가 아직 준비되지 않았어요. 그림 체험을 마치면 체험 실험실이 열려요.');}};
$('#language').onclick=()=>{state.progress.language=state.progress.language==='ko'?'en':'ko';if(state.preview)saved.language=state.progress.language;else persist();document.documentElement.lang=state.progress.language;if(state.screen==='lobby')renderHome();else render();};
$('#help').onclick=showHelp;$('#show-hint').onclick=hint;$('#close-help').onclick=()=>continueSound($('#help-dialog'));$('#photo').onclick=photo;$('#close-photo').onclick=()=>$('#photo-dialog').close();$('#ending-lab').onclick=openLab;
$('#resume-game').onclick=()=>continueSound($('#pause-dialog'));$('#pause-home').onclick=()=>{$('#pause-dialog').close();state.interrupted=null;showHome();};
for(const dialog of [$('#help-dialog'),$('#pause-dialog')])dialog.addEventListener('cancel',e=>{e.preventDefault();continueSound(dialog);});
for(const link of document.querySelectorAll('[data-leave-game]'))link.addEventListener('click',()=>{remember();stop();learning.abandon();});
$('#lab-reset').onclick=()=>{state.objects=clone(LAB_SETS[state.labSet].objects);state.selected=null;saveLab();remember();render();};
$('#practice-retry').onclick=()=>awardPractice(true);
$('#reset').onclick=()=>{$('#reset-title').textContent=say('Start a new adventure?','새 모험을 시작할까요?');$('#reset-copy').textContent=globalThis.SynkPlayAccount.status().mode==='account'?say('Reset Word Magic progress on your SYNK account, including other devices. Your coins and purchases stay.','다른 기기에서도 이 계정의 말의 마법사 진행이 초기화돼요. 코인과 구매품은 유지해요.'):say('This only clears Word Magic progress in this browser. Other games and shared learning records stay as they are.','이 브라우저의 말의 마법사 진행만 지워요. 다른 게임과 공통 학습 기록은 그대로 남아요.');$('#cancel-reset').textContent=say('Keep my progress','진행 유지');$('#confirm-reset').textContent=say('Reset Word Magic','말의 마법사 초기화');$('#reset-dialog').showModal();};
$('#cancel-reset').onclick=()=>$('#reset-dialog').close();$('#confirm-reset').onclick=()=>{const language=saved.language;saved=initialProgress();saved.language=language;state.progress=clone(saved);persist();$('#reset-dialog').close();renderHome();};
document.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]')||state.screen==='lobby'||e.repeat||e.altKey||e.ctrlKey||e.metaKey)return;const codes=['KeyA','KeyS','KeyD','KeyF','KeyG','KeyH'];if(codes.includes(e.code)){const ids=state.screen==='checkpoint'?state.check.choices:state.screen==='lab'?availableSpells(state.progress):chapter().pair;const id=ids[codes.indexOf(e.code)];if(id){e.preventDefault();chooseSpell(id);}}else if(/^Digit[1-4]$/.test(e.code)){const o=state.objects[Number(e.code.at(-1))-1];if(o){e.preventDefault();selectObject(o.id);}}else if(e.code==='KeyR'){e.preventDefault();replay();}else if(e.code==='Escape'){e.preventDefault();showPause();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.screen!=='lobby'){if(!document.querySelector('dialog[open]'))showPause();else{stop();remember();}if(state.screen==='checkpoint'&&!state.heard)learning.delivery(false);}});
window.addEventListener('pagehide',()=>{remember();stop();learning.abandon();});
window.addEventListener('pageshow',event=>{
 if(!event.persisted||state.screen==='lobby')return;
 for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();state.interrupted=null;
 if(state.preview){stop();render();}else restoreScene(state.progress.resume);
 showPause();
});
const assets=stage.load().then(()=>{heroStage.images=stage.images;heroStage.set(PUZZLES[0].objects,{chapter:0,scene:PUZZLES[0],animate:false});state.assetReady=true;}).catch(error=>{throw error;});assets.catch(()=>{});renderHome();
$('#launch-use').onclick=launchPlay;$('#launch-shop').onclick=()=>{launch.dismissed=true;renderLaunch();shop.open($('#lobby-shop'));};$('#launch-dismiss').onclick=()=>{launch.dismissed=true;renderLaunch();$('#start').focus({preventScroll:true});};$('#resume-adventure').onclick=()=>begin(nextUnfinished(saved),false,true);
if(query.get('shop')==='1')shop.open($('#lobby-shop'));else if(launch.requested)shop.refresh().then(()=>{launch.checked=true;renderLaunch();});
if(new URLSearchParams(location.search).has('qa'))globalThis.__wordMagic={state:()=>clone({...state,photoURL:null}),solution:()=>solution(PUZZLES[state.sceneIndex]),scene:()=>clone(PUZZLES[state.sceneIndex]),checkpoint:()=>clone(state.check)};
