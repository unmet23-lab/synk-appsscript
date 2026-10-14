import {TUTORS} from './tutor-profiles.mjs';

const names={'tutor:mongle':'몽글','tutor:kkamong':'까몽','tutor:marin':'마린',book:'책 펼치기',cafe:'카페',town:'싱크타운',memory:'기억 액자',photo:'사진 찍기',wardrobe:'옷장'};
// Line icons for the glass pins. Frame, camera and hanger stay icon-only; their names show on hover/focus.
const svg=d=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const icons={
 book:svg('<path d="M12 6.5C10.2 5 7.6 4.6 4 5v13c3.6-.4 6.2 0 8 1.5 1.8-1.5 4.4-1.9 8-1.5V5c-3.6-.4-6.2 0-8 1.5z"/><path d="M12 6.5v13"/>'),
 cafe:svg('<path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16M8.5 3.5c-.6.9.6 1.6 0 2.5M12 3.5c-.6.9.6 1.6 0 2.5"/>'),
 town:svg('<path d="M3.5 20.5h17M5.5 20.5V11l5-3.5 5 3.5v9.5M15.5 13.5h3v7"/><path d="M9 20.5v-4h3v4"/>'),
 memory:svg('<rect x="4" y="4" width="16" height="16" rx="2"/><path d="m4 16 4.5-4.5 4 4 2.5-2.5L20 18"/><circle cx="15.5" cy="8.5" r="1.4"/>'),
 photo:svg('<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.4-2h6.2l1.4 2h2A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="12.6" r="3.3"/>'),
 wardrobe:svg('<path d="M12 7.6V7a2.2 2.2 0 1 1 2.2-2.2"/><path d="M12 7.6 3.6 13.4a1.6 1.6 0 0 0 .9 2.9h15a1.6 1.6 0 0 0 .9-2.9z"/>')
};
const iconOnly=new Set(['memory','photo','wardrobe']);

/** One lazy renderer, with keyboard/touch targets over the actual scene objects. */
export function createHomeScene({container,onAction=()=>{},onStatus=()=>{}}){
 const canvasHost=container.querySelector('.living-canvas'),targets=container.querySelector('.living-targets'),status=container.querySelector('.living-status'),bubble=container.querySelector('.living-bubble');
 let engine=null,loading=null,disposed=false,active=false,tutor=null,reduced=false,slots={},dyes={},memory={},timer=0;
 const abort=new AbortController(),buttons=new Map();
 function say(id){
  const friend=TUTORS.find(t=>t.id===id);if(!friend)return;
  engine?.greet(id);clearTimeout(timer);bubble.textContent=`${friend.name} · ${friend.card.한마디}`;bubble.hidden=false;placeBubble(id);
  timer=setTimeout(()=>{bubble.hidden=true;},4800);
 }
 // The bubble sits above the friend who speaks, kept inside the room, with its tail on that friend.
 function placeBubble(id){
  const target=buttons.get(`tutor:${id}`);
  bubble.style.removeProperty('left');bubble.style.removeProperty('top');bubble.style.removeProperty('--tail');bubble.classList.remove('is-placed');
  if(!target||target.hidden)return;
  const box=container.getBoundingClientRect(),r=target.getBoundingClientRect();
  bubble.classList.add('is-placed');
  const w=bubble.offsetWidth,h=bubble.offsetHeight,cx=r.left+r.width/2-box.left;
  const left=Math.max(10,Math.min(box.width-w-10,cx-w/2)),top=Math.max(10,r.top-box.top-h-58);
  bubble.style.left=`${left}px`;bubble.style.top=`${top}px`;bubble.style.setProperty('--tail',`${Math.max(18,Math.min(w-18,cx-left))}px`);
 }
 function interact(id){if(!active)return;if(id.startsWith('tutor:'))say(id.slice(6));else onAction(id);}
 for(const [id,label]of Object.entries(names)){
  const button=document.createElement('button');button.type='button';button.className='living-target'+(id.startsWith('tutor:')?' living-friend':'')+(iconOnly.has(id)?' is-icon':'');
  if(icons[id]){const icon=document.createElement('span');icon.className='pin-icon';icon.innerHTML=icons[id];button.append(icon);}
  const text=document.createElement('span');text.className='pin-label';text.textContent=label;button.append(text);
  button.setAttribute('aria-label',id.startsWith('tutor:')?`${label}에게 인사하기`:label);button.dataset.sceneAction=id;button.hidden=true;
  button.addEventListener('click',()=>interact(id));targets.append(button);buttons.set(id,button);
 }
 function anchors(){
  for(const point of engine?.getAnchors?.()||[]){const button=buttons.get(point.id);if(!button)continue;button.style.left=`${Math.max(.07,Math.min(.93,point.x))*100}%`;button.style.top=`${Math.max(.06,Math.min(.94,point.y))*100}%`;button.hidden=point.visible===false;if(point.id.startsWith('tutor:'))button.setAttribute('aria-pressed',String(point.id===`tutor:${tutor}`));}
 }
 function showStatus(message,retry=false){status.replaceChildren();const p=document.createElement('p');p.textContent=message;status.append(p);if(retry){const b=document.createElement('button');b.type='button';b.textContent='방 다시 열기';b.addEventListener('click',()=>{engine?.dispose();engine=null;void load();});status.append(b);}status.hidden=!message;}
 async function load(){
  if(disposed||engine||loading||!tutor||!active)return;
  showStatus('방을 불러오고 있어요.');onStatus('loading');
  loading=(async()=>{
   try{
    const {mountLivingHomeScene}=await import('../synk-world-home/living-home-scene.mjs');
    if(disposed)return;
    const scene=await mountLivingHomeScene(canvasHost,{selectedTutor:tutor,slots,dyes,reducedMotion:reduced,quality:container.clientWidth<600?'low':'balanced',signal:abort.signal,onInteract:interact,onError:()=>{showStatus('방을 다시 열어 주세요.',true);onStatus('error');}});
    if(disposed){scene.dispose();return;}engine=scene;engine.setTutor(tutor);engine.setEquipment(slots,dyes);engine.setMemory(memory);engine.setReducedMotion(reduced);engine.setActive(active);anchors();showStatus('');onStatus('ready');
   }catch(error){if(!disposed){showStatus('방을 불러오지 못했어요. 연결을 확인한 뒤 다시 열어 주세요.',true);onStatus('error');}}
   finally{loading=null;}
  })();return loading;
 }
 const resize=new ResizeObserver(()=>requestAnimationFrame(anchors));resize.observe(container);
 return {
  setActive(value){active=!!value;container.dataset.active=String(active);targets.inert=!active;engine?.setActive(active);if(active){void load();anchors();}else{clearTimeout(timer);bubble.hidden=true;}},
  setTutor(value){tutor=value||null;engine?.setTutor(tutor);anchors();if(active)void load();},
  setEquipment(nextSlots={},nextDyes={}){slots={...nextSlots};dyes={...nextDyes};engine?.setEquipment(slots,dyes);},
  setMemory(value={}){memory={...value};engine?.setMemory(memory);},
  setReducedMotion(value){reduced=!!value;engine?.setReducedMotion(reduced);},
  async capture(){await load();if(!engine)throw Error('방을 연 다음 사진을 찍어 주세요.');return engine.capture();},
  metrics:()=>({active,tutor,loaded:!!engine,loading:!!loading,scene:engine?.metrics?.()||null}),
  dispose(){disposed=true;abort.abort();clearTimeout(timer);resize.disconnect();engine?.dispose();engine=null;targets.replaceChildren();}
 };
}
