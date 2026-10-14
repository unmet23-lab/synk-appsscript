// 이야기 장면 디테일(10-15 유호님 「이야기 화면 디테일 시안 1~8번 모두 앱에」). life-ui.mjs의 이야기 분기가 그린 뒤에 얹는다.
// ① 친구 말소리·해설 타자 소리(world-sound storyVoice) ② 글자 한 자씩 ⑦ 넘기는 손맛(사진 누르기·밀기·←/→, 이전 장면, 이야기 + 문제 칸 막대,
// 말하는 친구가 바뀌면 사진 0.18초 겹침) ⑧ 배운 표현 형광펜(누르면 표현 도움이 그 표현에 맞춰 열림).
// 움직임은 투명도뿐(글자는 자리를 옮기지 않는다). 움직임 줄이기면 글은 한 번에 보이고 사진은 바로 바뀐다. 장면은 저절로 넘어가지 않는다.
import {storyVoice} from '../brand-opening/world-sound.mjs';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const expressionKey=korean=>String(korean||'').replace(/[.!?。…]+$/,'').trim();

/** 이야기 한 줄의 HTML. ‘…’(이 레슨에서 배우는 한국어)과, 따옴표 없이 나와도 레슨 표현과 같은 글에 코랄 형광펜을 칠한다.
 * 레슨 표현과 맞는 형광펜에는 data-life-mark(표현 번호)를 붙여 누르면 표현 도움이 그 표현에 맞춰 열린다. */
export function storyLineMarkup(text,expressions=[]){
 const source=String(text??''),keys=expressions.map((e,index)=>({index,key:expressionKey(e.korean)})).filter(k=>k.key.length>=2);
 const marks=[];
 for(const match of source.matchAll(/‘([^‘’]{1,80})’/g)){
  const inner=match[1],hit=keys.find(k=>inner.includes(k.key)||k.key.includes(inner));
  marks.push({start:match.index+1,end:match.index+1+inner.length,index:hit?hit.index:null});
 }
 for(const {index,key} of keys){
  let from=0,at;
  while((at=source.indexOf(key,from))>=0){from=at+key.length;if(!marks.some(m=>at<m.end&&at+key.length>m.start))marks.push({start:at,end:at+key.length,index});}
 }
 marks.sort((a,b)=>a.start-b.start);
 let html='',cursor=0;
 for(const m of marks){
  if(m.start<cursor)continue;
  html+=escape(source.slice(cursor,m.start));
  const inner=source.slice(m.start,m.end);
  html+=m.index===null?`<mark class="life-say">${escape(inner)}</mark>`:`<mark class="life-say" data-life-mark="${m.index}" tabindex="0" aria-label="${escape(inner)} · 표현 도움 보기">${escape(inner)}</mark>`;
  cursor=m.end;
 }
 return html+escape(source.slice(cursor));
}

/** 이야기 진행 칸: 이야기 장면 수 + 문제 수. 지난 칸은 흐린 흰색, 지금 칸은 코랄. */
export function storySteps({scenes,questions,phase,sceneIndex=0,questionIndex=0,answered=false}){
 const storyState=k=>phase==='questions'?'done':phase!=='story'?'':k<sceneIndex?'done':k===sceneIndex?'now':'';
 const quizState=k=>phase!=='questions'?'':k<questionIndex+(answered?1:0)?'done':k===questionIndex?'now':'';
 const story=Array.from({length:scenes},(_,k)=>storyState(k)),quiz=Array.from({length:questions},(_,k)=>quizState(k));
 const cells=list=>list.map(state=>`<i${state?` class="is-${state}"`:''}></i>`).join('');
 return `<span class="life-steps" aria-hidden="true"><span class="life-steps-story" style="--n:${scenes}">${cells(story)}</span>${questions?`<span class="life-steps-quiz" style="--n:${questions}">${cells(quiz)}</span>`:''}</span>`;
}

// 글자 사이 쉼: 쉼표 +140ms, 마침표·물음표·느낌표 +230ms, 말줄임 +320ms, 띄어쓰기는 반쯤.
const CPS=23;
const pauseAfter=(ch,base)=>ch===' '?base*.55:ch===','?base+140:'.!?'.includes(ch)?base+230:ch==='…'?base+320:base;
const NAV_HINT='synk.world.story.nav-hint';

/** 이야기 장면 디테일을 한 판(#panel-content)에 붙인다. 판은 장면마다 다시 그려지므로, 그린 뒤 enter(장면)를 부른다. */
export function createStoryDetail({content,isActive,onNext,onPrev,onMark,reduced=()=>false}){
 let typing=null,photoSwap=null,down=null,swiped=false;
 const motionOff=()=>reduced()||matchMedia('(prefers-reduced-motion: reduce)').matches;
 const storageGet=()=>{try{return localStorage.getItem(NAV_HINT)==='used';}catch{return false;}};
 const markUsed=()=>{try{localStorage.setItem(NAV_HINT,'used');}catch{}content.querySelector('.life-story-hint')?.remove();};

 function stopTyping(){
  if(!typing)return;const {line,html,timer}=typing;typing=null;clearTimeout(timer);
  // 다 나타난 글은 원래 글자로 되돌린다(글자마다 쪼갠 span이 화면 읽기 프로그램에서 한 자씩 읽히지 않게). 형광펜은 그다음에 0.3초 동안 칠한다.
  if(!line.isConnected)return;
  line.innerHTML=html;delete line.dataset.typing;
  const marks=[...line.querySelectorAll('mark.life-say')];if(!marks.length||motionOff())return;
  for(const mark of marks)mark.classList.add('is-fresh');
  void line.offsetWidth;requestAnimationFrame(()=>{for(const mark of marks)mark.classList.remove('is-fresh');});
 }
 function startTyping(line,who){
  stopTyping();
  const html=line.innerHTML,units=[];
  const walk=node=>{for(const child of [...node.childNodes]){
   if(child.nodeType===3){const frag=document.createDocumentFragment();for(const ch of Array.from(child.textContent)){const span=document.createElement('span');span.className='life-c';span.textContent=ch;frag.append(span);units.push({el:span,ch});}child.replaceWith(frag);}
   else if(child.nodeType===1)walk(child);
  }};
  walk(line);line.dataset.typing='true';
  const voice=storyVoice(who,units.map(u=>u.ch).join(''),{cps:CPS}),base=1000/CPS;let k=0;
  typing={line,html,timer:0};
  const step=()=>{
   if(!typing||typing.line!==line)return;
   if(!line.isConnected){typing=null;return;}
   if(k>=units.length){stopTyping();return;}
   units[k].el.classList.add('is-on');voice.at(k);
   const wait=pauseAfter(units[k].ch,base);k++;typing.timer=setTimeout(step,wait);
  };
  step();
 }
 // 말하는 친구가 바뀌면 앞 사진을 위에 잠깐 두고 0.18초 동안 투명하게 지운다(자리·크기는 그대로).
 function crossfade(figure,previousSrc){
  photoSwap?.remove();photoSwap=null;
  const img=figure.querySelector(':scope>img');if(!img||!previousSrc||img.currentSrc===previousSrc||img.src===previousSrc)return;
  // 앞 사진은 span으로 감싼다(사진을 「.life-story-photo>img」 하나로 찾는 곳이 앞 사진을 집지 않게).
  const cover=document.createElement('span'),picture=document.createElement('img');cover.className='life-story-photo-prev';cover.setAttribute('aria-hidden','true');
  picture.src=previousSrc;picture.alt='';picture.decoding='sync';cover.append(picture);
  img.after(cover);photoSwap=cover;
  const fade=()=>{if(photoSwap!==cover)return;requestAnimationFrame(()=>{cover.classList.add('is-leaving');setTimeout(()=>{cover.remove();if(photoSwap===cover)photoSwap=null;},260);});};
  (img.decode?img.decode():Promise.resolve()).then(fade,fade);
 }

 /** 이야기 장면을 그린 직후에 부른다. previousSrc는 바로 전 장면 사진(같은 레슨일 때만). */
 function enter({who,previousSrc=null,first=false,signs=[]}={}){
  stopTyping();
  const stage=content.querySelector('.life-story-stage'),line=stage?.querySelector('.life-dialogue>p'),figure=stage?.querySelector('.life-story-photo');
  if(!stage||!line)return;
  try{document.fonts?.load?.("450 20px 'World Story Serif'",'이야기');}catch{}
  if(figure){
   figure.dataset.nav='true';
   if(!motionOff())crossfade(figure,previousSrc);
   // 첫 장면에서만 「눌러서 넘기기」 알약(한 번 넘기면 다시 나오지 않는다). 오른쪽 위에 글자 안내판이 있는 사진에서는 띄우지 않는다.
   const crowded=signs.some(s=>s.box[2]>60&&s.box[1]<18);
   if(first&&!crowded&&!storageGet()){const hint=document.createElement('span');hint.className='life-story-hint';hint.setAttribute('aria-hidden','true');hint.innerHTML='눌러서 넘기기 <span>→</span>';figure.append(hint);}
  }
  if(!motionOff()&&!document.hidden)startTyping(line,who);
 }

 // WORLD 판(#world-panel)도 dialog라서, 판 안에 따로 열린 창(표현 도움·연습)만 뺀다.
 const inSheet=el=>{const sheet=el?.closest?.('dialog');return !!sheet&&!sheet.contains(content);};
 const ON_PHOTO='button,.life-tutor';
 const storyTarget=event=>isActive()&&event.target instanceof Element&&!inSheet(event.target);
 function onPointerDown(event){
  if(!storyTarget(event)||event.button)return;
  const figure=event.target.closest('.life-story-photo');
  // 사진 위 단추·이름표와 튜터 알약(얼굴 포함)은 넘기기에서 뺀다
  down=figure&&!event.target.closest(ON_PHOTO)?{x:event.clientX,y:event.clientY}:null;swiped=false;
 }
 function onPointerUp(event){
  if(!down||!storyTarget(event))return;const dx=event.clientX-down.x,dy=event.clientY-down.y;down=null;
  if(Math.abs(dx)>40&&Math.abs(dx)>Math.abs(dy)*1.2){swiped=true;markUsed();(dx<0?onNext:onPrev)();}
 }
 function onClick(event){
  if(!storyTarget(event))return;
  const mark=event.target.closest('mark[data-life-mark]');
  if(mark&&!typing){event.preventDefault();onMark(Number(mark.dataset.lifeMark));return;}
  if(event.target.closest('.life-dialogue')){if(typing){event.preventDefault();stopTyping();}return;}
  const figure=event.target.closest('.life-story-photo');
  if(!figure||event.target.closest(ON_PHOTO))return;
  if(swiped){swiped=false;return;}
  const box=figure.getBoundingClientRect();markUsed();
  ((event.clientX-box.left)/box.width<.3?onPrev:onNext)();
 }
 function onKey(event){
  if(!isActive()||event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey)return;
  const target=event.target instanceof Element?event.target:null;
  if(target?.closest('input,textarea,select,[contenteditable]')||inSheet(target)||content.querySelector('dialog[open]'))return;
  const mark=target?.closest('mark[data-life-mark]');
  if(mark&&(event.key==='Enter'||event.key===' ')){event.preventDefault();if(typing)stopTyping();else onMark(Number(mark.dataset.lifeMark));return;}
  if(event.key==='ArrowRight'){event.preventDefault();onNext();}
  else if(event.key==='ArrowLeft'){event.preventDefault();onPrev();}
 }
 const onVisibility=()=>{if(document.hidden)stopTyping();},onCancel=()=>{down=null;};
 content.addEventListener('pointerdown',onPointerDown,{passive:true});
 content.addEventListener('pointerup',onPointerUp,{passive:true});
 content.addEventListener('pointercancel',onCancel,{passive:true});
 content.addEventListener('click',onClick);
 document.addEventListener('keydown',onKey);
 document.addEventListener('visibilitychange',onVisibility);
 return {
  enter,stop(){stopTyping();photoSwap?.remove();photoSwap=null;},
  typing:()=>!!typing,
  dispose(){stopTyping();content.removeEventListener('pointerdown',onPointerDown);content.removeEventListener('pointerup',onPointerUp);content.removeEventListener('pointercancel',onCancel);content.removeEventListener('click',onClick);document.removeEventListener('keydown',onKey);document.removeEventListener('visibilitychange',onVisibility);}
 };
}
