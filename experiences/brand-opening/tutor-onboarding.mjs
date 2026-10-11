import {TUTORS} from './tutor-profiles.mjs';
import {readTutorChoice,saveTutorChoice} from './tutor-choice.mjs';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const openings={marin:'배정 대기. …준비됐다.',kkamong:'…이 몸을 고르겠지? 당연히.',mongle:'어? 너구나! 같이 할래?'};
const summaries={marin:'작은 목표를 정하고, 차근차근 함께해요.',kkamong:'티격태격 웃으며 도전하고 싶은 너에게.',mongle:'호기심 가득, 뭐든 같이 해 보고 싶은 너에게.'};
const timing={marin:{hold:1600},kkamong:{hold:2100},mongle:{hold:1300}};
export function createTutorOnboarding({home,asset,onChoice=()=>{}}){
 let storage;try{storage=localStorage;}catch{}
 let owner='guest',choice=readTutorChoice(storage),draft=null,step='choose',continuation=null,active=false;
 let timers=new Set(),audio=null,sound=false,lastSound=0,lastVoice=null,tapCount=0,lastTap=0;
 try{sound=storage?.getItem('synk.world.tutor.sound')==='true';}catch{}
 const content=()=>document.querySelector('#panel-content');
 const later=(callback,ms)=>{const timer=setTimeout(()=>{timers.delete(timer);if(active&&!document.hidden)callback();},ms);timers.add(timer);return timer;};
 const cancelMotion=()=>{timers.forEach(clearTimeout);timers.clear();stopSound();};
 function stopSound(){audio?.pause();audio=null;}
 const selected=()=>TUTORS.find(t=>t.id===draft);
 const picture=(t,emotion='기본')=>asset(`assets/tutors/${t.images[emotion]}`);
 function image(t,large=false){return `<span class="tutor-portrait ${large?'large':''}" data-character="${t.id}"><img class="tutor-body" src="${picture(t)}" alt="${t.name}" width="480" height="480">${large?`<img class="tutor-face" src="${picture(t)}" alt="" aria-hidden="true" width="480" height="480">`:''}</span>`;}
 function soundButton(){return `<button class="tutor-sound" data-tutor-action="sound" aria-pressed="${sound}" aria-label="반응 소리 ${sound?'끄기':'켜기'}">반응 소리 ${sound?'켜짐':'꺼짐'}</button>`;}
 function header(){return `<div class="tutor-step-line"><span>${step==='choose'?'1 / 2 · 친구 만나기':'2 / 2 · 함께 시작하기'}</span>${soundButton()}</div>`;}
 function render(){
  cancelMotion();const t=selected();
  const html=step==='choose'?`${header()}<p class="tutor-intro">앞으로 한국어를 함께 배울 <strong>나의 AI 튜터</strong>예요.<br>성격도, 응원하는 방법도 달라요. 마음이 맞는 친구를 골라요.</p><div class="tutor-options" role="group" aria-label="함께할 AI 튜터 선택">${TUTORS.map(t=>`<button class="tutor-option" data-tutor-id="${t.id}" aria-pressed="${t.id===draft}">${image(t)}<strong>${t.name}</strong><small>${escape(t.card.칩[0])}</small><span class="tutor-selected" aria-hidden="true">${t.id===draft?'선택':'만나기'}</span></button>`).join('')}</div><div class="tutor-detail" ${t?`data-tutor="${t.id}"`:''}>${t?`<div class="tutor-stage"><button class="tutor-touch" data-tutor-action="touch" aria-label="${t.name}에게 인사하기">${image(t,true)}</button><div class="tutor-speech" data-character="${t.id}"><small id="tutor-speech-label">첫 인사</small><p id="tutor-speech" aria-live="polite"></p></div></div><div class="tutor-about"><h3>${t.name}<span>${escape(t.card.정체)}</span></h3><div class="tutor-traits">${t.card.칩.map(label=>`<span>${escape(label)}</span>`).join('')}</div><p>${escape(t.card.매력)}</p><p class="tutor-match">${summaries[t.id]}</p><details class="tutor-more"><summary>성격 더 보기</summary><p>${escape(t.card.소개)}</p><p><b>좋아해요</b> ${t.card.좋아해요.map(escape).join(' · ')}</p><p><b>조금 서툴러요</b> ${escape(t.card.못해요)}</p></details></div><div class="tutor-samples" aria-label="튜터 말투 미리 만나기"><button data-tutor-reaction="intro" aria-pressed="true">자기소개</button><button data-tutor-reaction="success" aria-pressed="false">잘했을 때</button><button data-tutor-reaction="retry" aria-pressed="false">어려울 때</button></div>`:`<div class="tutor-empty"><strong>어떤 응원이 너와 잘 맞을까?</strong><p>위의 친구를 누르면 자기소개와 말투를 만날 수 있어요.</p></div>`}</div><div class="tutor-footer"><button class="tutor-primary" data-tutor-action="confirm" ${t?'':'disabled'}>${t?`${t.name}${t.id==='kkamong'?'과':'과'} 함께하기`:'함께할 친구를 골라 주세요'}<span aria-hidden="true">→</span></button><p>언제든 설정에서 다시 고를 수 있어요.</p></div>`:
  `${header()}<div class="tutor-welcome" data-tutor="${t.id}"><div class="tutor-stage"><button class="tutor-touch" data-tutor-action="touch" aria-label="${t.name}에게 인사하기">${image(t,true)}</button><div class="tutor-speech" data-character="${t.id}"><small id="tutor-speech-label">우리의 첫 인사</small><p id="tutor-speech" aria-live="polite"></p></div></div><p class="tutor-welcome-copy"><strong>${t.name}, 앞으로 잘 부탁해.</strong><span>이 친구는 한국어를 함께 배울 AI 튜터예요.<br>놀이에서도 조작법을 알려 주고 함께 응원해요.</span></p><ol class="tutor-how"><li><span>01</span><div><strong>오늘 쓸 말을 만나요</strong><p>마루의 ‘다음 학습’에서 짧은 생활 한국어부터.</p></div></li><li><span>02</span><div><strong>놀이로 한번 해 봐요</strong><p>듣고 달리기, 글자 만나기, 박자에 맞춰 고르기.</p></div></li><li><span>03</span><div><strong>어려운 말은 다시 만나요</strong><p>‘복습’에서 돌아온 표현을 새로운 상황으로.</p></div></li></ol></div><div class="tutor-footer"><button class="tutor-primary" data-tutor-action="finish">${continuation?'함께 시작하기':'마루로 출발'}<span aria-hidden="true">→</span></button><button class="tutor-back" data-tutor-action="back">다른 친구도 만나 볼래요</button><p>선택은 이 기기에 기억해요.</p></div>`;
  home.showPanel(step==='choose'?'누구와 함께할까?':`${t.name}${t.id==='marin'?'과':'과'} 나의 첫 걸음`,html,{type:'tutor',eyebrow:'MY AI TUTOR'});
  document.querySelector('#world-panel').dataset.reduced=String(home.state.reduced);
  home.attachPanelResource({dispose(){cancelMotion();active=false;continuation=null;}});
  active=true;
  if(t){preload(t);react('intro',false);startIdle();}
 }
 function preload(t){for(const name of ['잔잔감음','놀람','기쁨',t.reactions.normal.뒤]){const img=new Image();img.src=picture(t,name);} }
 function setFace(emotion){const t=selected(),face=content()?.querySelector('.tutor-face');if(face&&t)face.src=picture(t,emotion);}
 function speak(text,label){
  const node=content()?.querySelector('#tutor-speech');if(!node)return;
  content().querySelector('#tutor-speech-label').textContent=label;
  node.textContent=text;
  const bubble=node.closest('.tutor-speech');bubble.classList.remove('speak');void bubble.offsetWidth;bubble.classList.add('speak');
  // Full readable text is present from the first frame; Marine reveals it in place.
  bubble.style.setProperty('--speech-duration',`${Math.min(1.4,text.length*.025)}s`);
 }
 function playSound(situation){
  if(!sound||!active||document.hidden||Date.now()-lastSound<800)return;
  const pool=selected()?.sounds[situation];if(!pool?.length)return;
  const options=pool.filter(file=>file!==lastVoice),file=(options.length?options:pool)[Math.floor(Math.random()*(options.length||pool.length))];
  stopSound();const soundClip=new Audio(asset(`assets/tutors/${file}`));audio=soundClip;lastVoice=file;lastSound=Date.now();soundClip.volume=.35;soundClip.playbackRate=1+(Math.random()-.5)*.06;
  soundClip.play().catch(()=>{if(audio===soundClip){sound=false;stopSound();const button=content()?.querySelector('.tutor-sound');if(button){button.textContent='반응 소리 꺼짐';button.setAttribute('aria-pressed','false');button.setAttribute('aria-label','반응 소리 켜기');}}});
 }
 function react(kind,withSound=true){
  cancelMotion();const t=selected();if(!t)return;
  content().querySelectorAll('[data-tutor-reaction]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.tutorReaction===kind)));
  const text=kind==='intro'?t.card.자기소개:kind==='success'?t.card.잘했을때:kind==='retry'?t.card.틀렸을때:openings[t.id];
  const label=kind==='intro'?'자기소개':kind==='success'?'잘했을 때 이렇게 응원해요':kind==='retry'?'어려울 때도 함께해요':'반가워';
  const motion=content().querySelector('.tutor-portrait.large');motion?.setAttribute('data-reaction',kind);
  setFace(kind==='success'?'기쁨':kind==='retry'?t.id==='marin'?'집중':'민망':t.reactions.normal.뒤);
  speak(text,label);
  if(withSound)playSound(kind==='success'?'기쁨':kind==='retry'?'안심':'기본');
  later(()=>{setFace('기본');motion?.removeAttribute('data-reaction');startIdle();},timing[t.id].hold);
 }
 function touch(){
  const now=Date.now();tapCount=now-lastTap<1200?tapCount+1:1;lastTap=now;
  cancelMotion();const t=selected();if(!t)return;
  const reaction=t.reactions[tapCount>=3?'repeat':'normal'];setFace(reaction.첫);playSound('기본');speak(openings[t.id],'인사를 건네면');
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
  continuation=then;draft=force?choice:null;step='choose';render();return true;
 }
 function finish(){
  const t=selected();if(!t)return;
  const after=continuation;continuation=null;choice=t.id;
  const saved=saveTutorChoice(storage,owner,choice);onChoice(t,{saved,owner});
  home.closePanel();home.toast(saved?`${t.name}${t.id==='marin'?'과':'과'} 함께해요. 설정에서 다시 만날 수 있어요.`:`${t.name}${t.id==='marin'?'과':'과'} 함께해요. 이 브라우저에서는 선택을 저장하지 못했어요.`);
  after?.();
 }
 function click(event){
  if(!active)return;const button=event.target.closest('[data-tutor-id],[data-tutor-reaction],[data-tutor-action]');if(!button||!content()?.contains(button))return;
  if(button.dataset.tutorId){const after=continuation;draft=button.dataset.tutorId;tapCount=0;render();continuation=after;playSound('기본');content().querySelector(`[data-tutor-id="${draft}"]`)?.focus({preventScroll:true});return;}
  if(button.dataset.tutorReaction){react(button.dataset.tutorReaction);return;}
  const action=button.dataset.tutorAction;
  if(action==='sound'){sound=!sound;try{storage?.setItem('synk.world.tutor.sound',String(sound));}catch{}button.textContent=`반응 소리 ${sound?'켜짐':'꺼짐'}`;button.setAttribute('aria-pressed',String(sound));button.setAttribute('aria-label',`반응 소리 ${sound?'끄기':'켜기'}`);if(sound)playSound('기본');else stopSound();}
  else if(action==='touch')touch();
  else if(action==='confirm'&&selected()){const after=continuation;step='welcome';render();continuation=after;}
  else if(action==='back'){const after=continuation;step='choose';render();continuation=after;}
  else if(action==='finish')finish();
 }
 document.addEventListener('click',click);
 document.addEventListener('visibilitychange',()=>{if(!active)return;cancelMotion();setFace('기본');if(!document.hidden)startIdle();});
 const media=matchMedia('(prefers-reduced-motion:reduce)');media.addEventListener('change',()=>{if(active){cancelMotion();setFace('기본');if(!home.state.reduced)startIdle();}});
 return Object.freeze({open,ensure:then=>open({then}),choice:()=>TUTORS.find(t=>t.id===choice)||null,setOwner(value){const next=value||'guest';if(owner===next)return;const wasActive=active;owner=next;choice=readTutorChoice(storage,owner);draft=null;continuation=null;cancelMotion();if(wasActive){home.closePanel();open();}onChoice(this.choice(),{saved:true,owner});},metrics:()=>({owner,tutor:choice,draft,step,active,sound})});
}
