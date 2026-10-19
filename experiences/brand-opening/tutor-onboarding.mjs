import {TUTORS} from './tutor-profiles.mjs';
import {readTutorChoice,saveTutorChoice,choiceKey,TUTOR_IDS} from './tutor-choice.mjs';
import {tutorPhoto,profilePhoto,preloadTutorPhotos} from './tutor-photos.mjs';
import {motionOn,spring,ink,talk,squish,slidePill,bindPress} from './world-motion.mjs';
import {t as tr,tMessage,currentLang} from './world-lang.mjs';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const openings={marin:'배정 대기. …준비됐다.',kkamong:'…이 몸을 고르겠지? 당연히.',mongle:'어? 너구나! 같이 할래?'};
// 화면 언어(10-19 1판): 고르기 화면의 글과 성격 카드는 화면 언어로, 말풍선(튜터 대사)은 2판까지 한국어 그대로다.
// 한국어는 정본 카드(tutor-profiles.mjs)를 그대로 읽고, 영어·몽골어는 표(tutor.card.<id>.*·tutor.name.<id>)에서 읽는다.
const CARD_KEYS={정체:'identity',매력:'charm',소개:'about',못해요:'weak'};
const cardText=(tutor,field)=>currentLang()==='ko'?tutor.card[field]:tr(`tutor.card.${tutor.id}.${CARD_KEYS[field]}`);
const cardList=(tutor,field,prefix)=>currentLang()==='ko'?tutor.card[field]:tutor.card[field].map((_,index)=>tr(`tutor.card.${tutor.id}.${prefix}${index+1}`));
const nameOf=tutor=>currentLang()==='ko'?tutor.name:tr(`tutor.name.${tutor.id}`);
// 처음 만날 때 먼저 보여 주는 튜터(확정은 「○○과 함께하기」를 눌러야 된다). 위 탭으로 한 명씩 넘겨 본다.
const FIRST_PREVIEW='mongle';
const timing={marin:{hold:1600},kkamong:{hold:2100},mongle:{hold:1300}};
export function createTutorOnboarding({home,asset,onChoice=()=>{},commitChoice=null,getChoiceStatus=()=>null}){
 let storage;try{storage=localStorage;}catch{}
 let owner='guest',choice=readTutorChoice(storage),draft=null,step='choose',continuation=null,active=false;
 let committing=false,commitError='',generation=0,rendering=false;
 let timers=new Set(),audio=null,sound=false,lastSound=0,lastVoice=null,tapCount=0,lastTap=0,swapFrom=null;
 try{sound=storage?.getItem('synk.world.tutor.sound')==='true';}catch{}
 const content=()=>document.querySelector('#panel-content');
 const later=(callback,ms)=>{const timer=setTimeout(()=>{timers.delete(timer);if(active&&!document.hidden)callback();},ms);timers.add(timer);return timer;};
 const cancelMotion=()=>{timers.forEach(clearTimeout);timers.clear();stopSound();};
 function stopSound(){audio?.pause();audio=null;}
 const selected=()=>TUTORS.find(t=>t.id===draft);
 const picture=(t,emotion='기본')=>tutorPhoto(t.id,'onb',emotion);
 function image(t,large=false){return `<span class="tutor-portrait ${large?'large':''}" data-character="${t.id}"><img class="tutor-body" src="${large?picture(t):profilePhoto(t.id)}" alt="${nameOf(t)}" width="512" height="512">${large?`<img class="tutor-face" src="${picture(t)}" alt="" aria-hidden="true" width="512" height="512">`:''}</span>`;}
 function soundButton(){return `<button class="tutor-sound" data-tutor-action="sound" aria-pressed="${sound}" aria-label="${tr(sound?'tutor.sound.turnOff':'tutor.sound.turnOn')}">${tr(sound?'tutor.sound.on':'tutor.sound.off')}</button>`;}
 function header(){return `<div class="tutor-step-line"><span>${tr(step==='choose'?'tutor.step.choose':'tutor.step.start')}</span>${soundButton()}</div>`;}
 function choiceStatus(){try{return getChoiceStatus(owner)||{};}catch{return {blocked:true,message:tr('tutor.status.unknown')};}}
 function refreshStatus(){
  if(!active)return;
  const status=choiceStatus(),blocked=committing||status.blocked===true||['loading','saving'].includes(status.phase);
  for(const button of content()?.querySelectorAll('[data-tutor-id],[data-tutor-action="confirm"],[data-tutor-action="finish"],[data-tutor-action="back"]')||[])button.disabled=blocked||button.dataset.tutorAction==='confirm'&&!selected();
  const button=content()?.querySelector('[data-tutor-action="finish"]');if(button)button.setAttribute('aria-busy',String(committing));
  const note=content()?.querySelector('.tutor-footer>p');
  if(note){note.setAttribute('role','status');note.setAttribute('aria-live','polite');note.textContent=tMessage(commitError)||(committing?tr('tutor.status.saving'):tMessage(status.message)||tr(status.mode==='account'?'tutor.status.account':'tutor.status.device'));}
 }
 function render(){
  cancelMotion();const t=selected();
  const html=step==='choose'?`${header()}<p class="tutor-intro">${tr('tutor.intro')}</p><div class="tutor-options" role="group" aria-label="${tr('tutor.title.choose')}">${TUTORS.map(t=>`<button class="tutor-option" data-tutor-id="${t.id}" aria-pressed="${t.id===draft}">${image(t)}<strong>${nameOf(t)}</strong><small>${escape(cardList(t,'칩','chip')[0])}</small><span class="tutor-selected" aria-hidden="true">${tr(t.id===draft?'tutor.viewing':'tutor.view')}</span></button>`).join('')}</div><div class="tutor-detail" ${t?`data-tutor="${t.id}"`:''}>${t?`<div class="tutor-stage"><button class="tutor-touch" data-tutor-action="touch" aria-label="${tr('tutor.greet',{name:nameOf(t)})}">${image(t,true)}</button><div class="tutor-speech" data-character="${t.id}"><small class="tutor-speech-head"><b class="w-name" data-who="${t.id}">${nameOf(t)}</b><span id="tutor-speech-label">${tr('tutor.speech.intro')}</span></small><p id="tutor-speech" aria-live="polite"></p></div></div><div class="tutor-about"><h3>${nameOf(t)}<span>${escape(cardText(t,'정체'))}</span></h3><div class="tutor-traits">${cardList(t,'칩','chip').map(label=>`<span>${escape(label)}</span>`).join('')}</div><p>${escape(cardText(t,'매력'))}</p><p class="tutor-match">${tr(`tutor.card.${t.id}.match`)}</p><details class="tutor-more"><summary>${tr('tutor.more')}</summary><p>${escape(cardText(t,'소개'))}</p><p><b>${tr('tutor.likes')}</b> ${cardList(t,'좋아해요','like').map(escape).join(' · ')}</p><p><b>${tr('tutor.weak')}</b> ${escape(cardText(t,'못해요'))}</p></details></div><div class="tutor-samples" aria-label="${tr('tutor.samples')}"><button data-tutor-reaction="intro" aria-pressed="true">${tr('tutor.speech.intro')}</button><button data-tutor-reaction="success" aria-pressed="false">${tr('tutor.speech.success')}</button><button data-tutor-reaction="retry" aria-pressed="false">${tr('tutor.speech.retry')}</button></div>`:`<div class="tutor-empty"><p>${tr('tutor.empty')}</p></div>`}</div><div class="tutor-footer"><button class="tutor-primary" data-tutor-action="confirm" ${t?'':'disabled'}>${t?tr('tutor.confirm',{name:nameOf(t)}):tr('tutor.confirmEmpty')}<span aria-hidden="true">→</span></button><p>${tr('tutor.anytime')}</p></div>`:
  `${header()}<div class="tutor-welcome" data-tutor="${t.id}"><div class="tutor-stage"><button class="tutor-touch" data-tutor-action="touch" aria-label="${tr('tutor.greet',{name:nameOf(t)})}">${image(t,true)}</button><div class="tutor-speech" data-character="${t.id}"><small class="tutor-speech-head"><b class="w-name" data-who="${t.id}">${nameOf(t)}</b><span id="tutor-speech-label">${tr('tutor.speech.first')}</span></small><p id="tutor-speech" aria-live="polite"></p></div></div><p class="tutor-welcome-copy"><strong>${tr('tutor.welcome.title',{name:nameOf(t)})}</strong><span>${tr('tutor.welcome.body',{name:nameOf(t)})}</span></p><ol class="tutor-how"><li><span>01</span><div><strong>${tr('tutor.how.learn.title')}</strong><p>${tr('tutor.how.learn.body')}</p></div></li><li><span>02</span><div><strong>${tr('tutor.how.play.title')}</strong><p>${tr('tutor.how.play.body')}</p></div></li><li><span>03</span><div><strong>${tr('tutor.how.review.title')}</strong><p>${tr('tutor.how.review.body')}</p></div></li></ol></div><div class="tutor-footer"><button class="tutor-primary" data-tutor-action="finish">${tr(continuation?'tutor.start':'tutor.goTown')}<span aria-hidden="true">→</span></button><button class="tutor-back" data-tutor-action="back">${tr('tutor.back')}</button><p>${tr('tutor.status.device')}</p></div>`;
  const after=continuation;rendering=true;
  try{home.showPanel(step==='choose'?tr('tutor.title.choose'):tr('tutor.title.start',{name:nameOf(t)}),html,{type:'tutor',eyebrow:'MY AI TUTOR'});}finally{rendering=false;continuation=after;}
  document.querySelector('#world-panel').dataset.reduced=String(home.state.reduced);
  home.attachPanelResource({dispose(){cancelMotion();active=false;if(!rendering){generation++;committing=false;commitError='';continuation=null;}}});
  active=true;
  refreshStatus();
  if(t){preload(t);react('intro',false);startIdle();enterMotion();}
 }
 // 10-17 움직임: 숨쉬기 · 친구 바뀜(알약 미끄러짐 + 사진이 아래에서 솟고 말풍선이 피어남) · 이름 잉크 · 주 알약 빛 스침.
 function enterMotion(){
  const root=content(),from=swapFrom;swapFrom=null;if(!root||!motionOn())return;
  root.querySelector('.tutor-touch')?.classList.add('w-breathe');
  root.querySelector('.tutor-primary')?.classList.add('w-sheen');
  if(from){
   slidePill(root.querySelector('.tutor-options'),root.querySelector('.tutor-option[aria-pressed=true]'),from);
   spring(root.querySelector('.tutor-portrait.large'),[{opacity:0,transform:'translateY(26px) scale(.9)'},{opacity:1,transform:'translateY(-4px) scale(1.02)',offset:.6},{transform:'none'}],{duration:640});
   spring(root.querySelector('.tutor-speech'),[{opacity:0,transform:'scale(.86)'},{opacity:1,transform:'scale(1.02)',offset:.6},{transform:'scale(1)'}],{duration:460});
  }
  ink(root.querySelector('.tutor-about h3, .tutor-welcome-copy strong'),{delay:from?80:600});
 }
 function preload(t){preloadTutorPhotos(t.id,'onb');}
 function setFace(emotion){const t=selected(),face=content()?.querySelector('.tutor-face');if(face&&t)face.src=picture(t,emotion);}
 function speak(text,label){
  const node=content()?.querySelector('#tutor-speech');if(!node)return;
  content().querySelector('#tutor-speech-label').textContent=label;
  const bubble=node.closest('.tutor-speech');
  talk(node,text,selected()?.id);bubble.classList.toggle('w-talking',motionOn());
  bubble.classList.remove('speak');void bubble.offsetWidth;bubble.classList.add('speak');
  // Full readable text is present from the first frame; Marine reveals it in place.
  bubble.style.setProperty('--speech-duration',`${Math.min(1.4,text.length*.025)}s`);
 }
 function playSound(situation){
  if(!sound||!active||document.hidden||Date.now()-lastSound<800)return;
  const pool=selected()?.sounds[situation];if(!pool?.length)return;
  const options=pool.filter(file=>file!==lastVoice),file=(options.length?options:pool)[Math.floor(Math.random()*(options.length||pool.length))];
  stopSound();const soundClip=new Audio(asset(`assets/tutors/${file}`));audio=soundClip;lastVoice=file;lastSound=Date.now();soundClip.volume=.35;soundClip.playbackRate=1+(Math.random()-.5)*.06;
  soundClip.play().catch(()=>{if(audio===soundClip){sound=false;stopSound();const button=content()?.querySelector('.tutor-sound');if(button){button.textContent=tr('tutor.sound.off');button.setAttribute('aria-pressed','false');button.setAttribute('aria-label',tr('tutor.sound.turnOn'));}}});
 }
 function react(kind,withSound=true){
  cancelMotion();const t=selected();if(!t)return;
  content().querySelectorAll('[data-tutor-reaction]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.tutorReaction===kind)));
  const text=kind==='intro'?t.card.자기소개:kind==='success'?t.card.잘했을때:kind==='retry'?t.card.틀렸을때:openings[t.id];
  const label=tr(kind==='intro'?'tutor.speech.intro':kind==='success'?'tutor.speech.success':kind==='retry'?'tutor.speech.retry':'tutor.speech.hello');
  const motion=content().querySelector('.tutor-portrait.large');motion?.setAttribute('data-reaction',kind);
  setFace(kind==='success'?'기쁨':kind==='retry'?t.id==='marin'?'집중':'민망':t.reactions.normal.뒤);
  speak(text,label);
  if(withSound)playSound(kind==='success'?'기쁨':kind==='retry'?'안심':'기본');
  later(()=>{setFace('기본');motion?.removeAttribute('data-reaction');startIdle();},timing[t.id].hold);
 }
 function touch(){
  const now=Date.now();tapCount=now-lastTap<1200?tapCount+1:1;lastTap=now;
  cancelMotion();const t=selected();if(!t)return;
  const reaction=t.reactions[tapCount>=3?'repeat':'normal'];setFace(reaction.첫);playSound('기본');speak(openings[t.id],tr('tutor.speech.touch'));squish(content()?.querySelector('.tutor-portrait.large'));
  later(()=>setFace(reaction.뒤),240);
  later(()=>{setFace('기본');startIdle();},timing[t.id].hold);
 }
 function startIdle(){
  if(!active||home.state.reduced||document.hidden)return;
  later(()=>{setFace('잔잔감음');later(()=>{setFace('기본');startIdle();},140);},4000+Math.random()*2400);
 }
 function open({force=false,then=null}={}){
  if(choice&&!force){then?.();return false;}
  if(active){if(then)continuation=then;return true;}
  continuation=then;draft=(force&&choice)||FIRST_PREVIEW;step='choose';commitError='';render();return true;
 }
 async function finish(){
  const t=selected(),status=choiceStatus();if(!t||committing||status.blocked||['loading','saving'].includes(status.phase))return;
  const expectedOwner=owner,expected=++generation,after=continuation;
  committing=true;commitError='';refreshStatus();
  try{
   const remoteResult=commitChoice?await commitChoice(t.id,expectedOwner):null;
   if(expected!==generation||owner!==expectedOwner||!active)return;
   const result=remoteResult??{saved:saveTutorChoice(storage,expectedOwner,t.id),mode:'device'};
   if(remoteResult!=null&&result?.saved!==true)throw Error(result?.message||tr('tutor.saveFailed'));
   const saved=result?.saved===true;if(remoteResult!=null)saveTutorChoice(storage,expectedOwner,t.id);
   continuation=null;choice=t.id;committing=false;onChoice(t,{saved,owner:expectedOwner,source:'user',mode:result?.mode||'device'});
   home.closePanel();home.toast(result?.message||tr(saved?'tutor.chosen':'tutor.chosenUnsaved',{name:nameOf(t)}));
   after?.();
  }catch(error){
   if(expected!==generation||owner!==expectedOwner||!active)return;
   commitError=error?.message||tr('tutor.saveFailed');
  }finally{if(expected===generation){committing=false;refreshStatus();}}
 }
 function click(event){
  if(!active)return;const button=event.target.closest('[data-tutor-id],[data-tutor-reaction],[data-tutor-action]');if(!button||!content()?.contains(button))return;
  if(button.disabled||committing&&(['confirm','finish','back'].includes(button.dataset.tutorAction)||button.dataset.tutorId))return;
  if(button.dataset.tutorId){const after=continuation;const old=content()?.querySelector('.tutor-option[aria-pressed=true]');swapFrom=old&&button.dataset.tutorId!==draft?old.getBoundingClientRect():null;draft=button.dataset.tutorId;tapCount=0;render();continuation=after;playSound('기본');content().querySelector(`[data-tutor-id="${draft}"]`)?.focus({preventScroll:true});return;}
  if(button.dataset.tutorReaction){react(button.dataset.tutorReaction);return;}
  const action=button.dataset.tutorAction;
  if(action==='sound'){sound=!sound;try{storage?.setItem('synk.world.tutor.sound',String(sound));}catch{}button.textContent=tr(sound?'tutor.sound.on':'tutor.sound.off');button.setAttribute('aria-pressed',String(sound));button.setAttribute('aria-label',tr(sound?'tutor.sound.turnOff':'tutor.sound.turnOn'));if(sound)playSound('기본');else stopSound();}
  else if(action==='touch')touch();
  else if(action==='confirm'&&selected()){const after=continuation;step='welcome';render();continuation=after;}
  else if(action==='back'){const after=continuation;step='choose';render();continuation=after;}
  else if(action==='finish')void finish();
 }
 document.addEventListener('click',click);
 bindPress(document,'#world-panel.tutor-panel :is(.tutor-option,.tutor-primary,.tutor-sound,.tutor-back,[data-tutor-reaction])');
 document.addEventListener('visibilitychange',()=>{if(!active)return;cancelMotion();setFace('기본');if(!document.hidden)startIdle();});
 const media=matchMedia('(prefers-reduced-motion:reduce)');media.addEventListener('change',()=>{if(active){cancelMotion();setFace('기본');if(!home.state.reduced)startIdle();}});
 return Object.freeze({open,ensure:then=>open({then}),choice:()=>TUTORS.find(t=>t.id===choice)||null,refreshStatus,
  applyChoice(tutorId,expectedOwner){
   if(expectedOwner!==owner)return false;if(tutorId!==null&&!TUTOR_IDS.includes(tutorId))throw TypeError('Unknown tutor');
   choice=tutorId;let saved=false;
   if(tutorId)saved=saveTutorChoice(storage,owner,tutorId);else try{storage?.removeItem(choiceKey(owner));saved=!!storage;}catch{}
   onChoice(this.choice(),{saved,owner,source:'remote'});refreshStatus();return true;
  },
  setOwner(value){const next=value||'guest';if(owner===next){refreshStatus();return;}generation++;committing=false;commitError='';const wasActive=active;owner=next;choice=readTutorChoice(storage,owner);draft=null;continuation=null;cancelMotion();if(wasActive){home.closePanel();open();}onChoice(this.choice(),{saved:true,owner,source:'owner'});},metrics:()=>({owner,tutor:choice,draft,step,active,sound,committing,commitError})});
}
