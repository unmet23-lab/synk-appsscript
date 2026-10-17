// 우리 동네 — WORLD 홈의 첫 장면(유호님 10-14 「첫 화면 3번, 홈 4번」).
// 펠트 미니어처 동네 사진 한 장 위에 장소 단추를 얹는다. 세 친구도 그 사진 안에 같이 구웠다(정본 누끼를 얹지 않는다, 결정 표 10-14).
// 장소 하나 = 생활 팩 하나, 우리 집(빌라)은 3D 방으로 들어가는 문. 스스로 움직이는 것은 없다(멀미 기준).
export const TOWN_PLACES=[
 {id:'home',name:'우리 집',pack:null,note:'세 친구의 방'},
 {id:'cafe',name:'카페',pack:'cafe'},
 {id:'store',name:'편의점',pack:'store'},
 {id:'clock',name:'시계탑',pack:'plans'},
 {id:'bus',name:'버스 정류장',pack:'transit'},
 {id:'street',name:'길',pack:'directions'},
 {id:'friends',name:'세 친구',pack:'greetings'}
];
// 그림마다 장소 자리(%). pin은 이름표 가운데, area는 그 장소를 손가락으로 눌러도 되는 넓은 자리 [x,y,너비,높이].
// 이름표는 시계·얼굴처럼 그림의 볼거리를 가리지 않는 자리에 둔다. 그림을 다시 구우면 이 표를 그 그림에 맞춰 다시 잰다(격자 사진: .tmp/world-firstrun-20261014).
// visible: 세로 화면에서 아래 카드에 가리면 안 되는 그림 높이 비율(횡단보도 끝까지). 낮은 휴대폰은 「길」을 버스 앞 찻길(alt)로 옮기고
// 그 아래(compact)까지만 지키며, 그래도 모자랄 때만 그림을 줄인다(양옆에 띠가 생기므로 마지막 수단).
export const TOWN_SCENES={
 landscape:{images:{day:'home/town-land-v2.webp',evening:'home/town-land-v2-evening.webp',night:'home/town-land-v2-night.webp'},width:1672,height:941,places:{
  home:{pin:[64,23],area:[53,15,22,24]},
  cafe:{pin:[37.5,47.5],area:[31,44,13,26]},
  store:{pin:[54,44.5],area:[45,41,17,29]},
  clock:{pin:[78,35.5],area:[72,37,13,27]},
  bus:{pin:[93,64],area:[82,56,18,25]},
  street:{pin:[74,88],area:[58,81,32,14]},
  friends:{pin:[57,57.5],area:[46,60,22,21]}
 }},
 portrait:{images:{day:'home/town-port-v1.webp',evening:'home/town-port-v1-evening.webp',night:'home/town-port-v1-night.webp'},width:941,height:1672,visible:.6,compact:.535,places:{
  home:{pin:[49,15.5],area:[35,9,28,20]},
  cafe:{pin:[11.5,32.5],area:[2,28,18,13]},
  store:{pin:[37,30.5],area:[21,27,26,15]},
  clock:{pin:[78,20],area:[61,19,32,18]},
  bus:{pin:[86,42.5],area:[69,34,31,16]},
  street:{pin:[53,56],area:[30,52,46,8],alt:{pin:[77,51],area:[62,48,36,6]}},
  friends:{pin:[35,40],area:[17,41,34,10]}
 }}
};
// 기기 시계를 따라 동네가 낮·저녁·밤으로 바뀐다(같은 세트를 같은 자리에서 다시 구운 사진 세 벌). 다녀오면 바뀌어 있을 뿐, 화면에서 움직이지 않는다.
export function townTime(date=new Date()){const m=date.getHours()*60+date.getMinutes();return m>=360&&m<1020?'day':m>=1020&&m<1170?'evening':'night';}
const TIME_NAMES={day:'낮',evening:'저녁',night:'밤'};
import {motionOn,popIn,glow,bindPress} from './world-motion.mjs';
const HINT_KEY='synk.world.town.hint.v1';
const icon=d=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const DOOR=icon('<path d="M4 10.4 12 4l8 6.4V19a1.5 1.5 0 0 1-1.5 1.5h-4V15h-5v5.5h-4A1.5 1.5 0 0 1 4 19z"/>');
const CHECK=icon('<path d="m5 12.5 4.2 4.2L19 7"/>');

/** 장소 단추와 진도 표시만 맡는다. 무엇을 열지는 onPlace가 정한다. obstacle은 세로 화면에서 그림이 가리면 안 되는 아래 카드다. */
export function createHomeTown({container,asset,onPlace=()=>{},obstacle=null}){
 // 그림은 자르지 않고 화면 안에 다 넣는다. 사진이 닿지 않는 자리는 사진 가장자리에서 읽은 배경지 색으로 이어 칠한다(edges).
 const frame=document.createElement('div');frame.className='town-frame';
 const img=document.createElement('img');img.className='town-photo';img.alt='';img.decoding='async';img.draggable=false;
 const areas=document.createElement('div');areas.className='town-areas';areas.setAttribute('aria-hidden','true');
 const pins=document.createElement('div');pins.className='town-pins';
 frame.append(img,areas,pins);container.append(frame);
 const buttons=new Map(),zones=new Map();
 let layout='portrait',progress=null,active=true,time='',timer=0,edges=null,box={left:0,top:0,width:0,height:0},compact=false;
 const requested=new URLSearchParams(location.search).get('townTime'),forced=['day','evening','night'].includes(requested)?requested:'';
 for(const place of TOWN_PLACES){
  const button=document.createElement('button');button.type='button';button.className='town-pin';button.dataset.townPlace=place.id;
  button.innerHTML=`<span class="town-pin-dot" aria-hidden="true"></span><span class="town-pin-name"></span><span class="town-pin-count"></span>`;
  button.querySelector('.town-pin-name').textContent=place.name;
  if(place.id==='home')button.querySelector('.town-pin-dot').outerHTML=`<span class="town-pin-icon" aria-hidden="true">${DOOR}</span>`;
  button.addEventListener('click',()=>{if(active){closeHint();shine(place.id);onPlace(place);}});
  pins.append(button);buttons.set(place.id,button);
  // 건물 자체를 눌러도 같은 곳으로 간다. 화면 읽기 프로그램에는 이름표 단추 하나만 보인다.
  const zone=document.createElement('div');zone.className='town-area';zone.dataset.townArea=place.id;
  zone.addEventListener('click',()=>{if(active){closeHint();shine(place.id);onPlace(place);}});
  // PC에서 건물 위에 올리면 그 이름표가 같이 밝아진다(정지 표시, 움직임 없음).
  zone.addEventListener('pointerenter',()=>button.classList.add('is-hover'));zone.addEventListener('pointerleave',()=>button.classList.remove('is-hover'));
  areas.append(zone);zones.set(place.id,zone);
 }
 // 10-17 움직임: 동네에 들어오면 이름표가 하나씩 톡톡 켜지고, 사진은 18초 동안 아주 조금 다가오며, 누른 장소엔 불빛이 번진다. 「지금」 이름표의 빛 고리는 world-motion.css.
 const pinBase=b=>`translate(${b.style.getPropertyValue('--pin-x')||'-50%'},-50%)`;
 bindPress(pins,'.town-pin',{base:pinBase});
 function shine(id){const zone=zones.get(id);if(!zone)return;const n=v=>parseFloat(v)||0;glow(frame,n(zone.style.left)+n(zone.style.width)/2,n(zone.style.top)+n(zone.style.height)/2);}
 let arrived=false;
 function arrive(){if(arrived||!motionOn())return;arrived=true;frame.classList.add('w-drift');popIn(TOWN_PLACES.map(p=>buttons.get(p.id)),{delay:350,gap:85,base:pinBase});}
 // 처음 온 사람에게만 한 번: 장소를 누르면 배운다는 것. 닫거나 장소를 한 번 누르면 다시 나오지 않는다.
 let seen=false;try{seen=localStorage.getItem(HINT_KEY)==='1';}catch{}
 const hint=document.createElement('div');hint.className='town-hint';hint.hidden=seen;
 hint.innerHTML='<i aria-hidden="true"></i><p>장소를 누르면 그곳에서 쓰는 한국어를 배워요.</p><button type="button" aria-label="안내 닫기"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/></svg></button>';
 function closeHint(){if(hint.hidden)return;hint.hidden=true;try{localStorage.setItem(HINT_KEY,'1');}catch{}}
 hint.querySelector('button').addEventListener('click',closeHint);
 container.append(hint);
 function paint(){
  const src=asset(`assets/${TOWN_SCENES[layout].images[time]}`);
  if(img.getAttribute('src')!==src){edges=null;img.src=src;}
 }
 // 사진 네 가장자리의 색을 작은 캔버스로 읽는다(같은 출처 그림). 낮·저녁·밤 어느 사진이든 손으로 맞춘 색 없이 이어진다.
 function readEdges(){
  if(!img.naturalWidth)return;
  const portraitImage=img.naturalHeight>img.naturalWidth,w=portraitImage?18:32,h=portraitImage?32:18;
  try{
   const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
   const g=canvas.getContext('2d',{willReadFrequently:true});g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';g.drawImage(img,0,0,w,h);
   const d=g.getImageData(0,0,w,h).data,px=(x,y)=>{const i=(y*w+x)*4;return `rgb(${d[i]},${d[i+1]},${d[i+2]})`;};
   const col=x=>Array.from({length:h},(_,y)=>`${px(x,y)} ${(y/(h-1)*100).toFixed(1)}%`).join(','),row=y=>Array.from({length:w},(_,x)=>`${px(x,y)} ${(x/(w-1)*100).toFixed(1)}%`).join(',');
   edges={left:col(0),right:col(w-1),top:row(0),bottom:row(h-1)};
  }catch{edges=null;}
  fill();
 }
 function fill(){
  if(!edges){container.style.removeProperty('background');return;}
  // 가로 넓은 화면은 왼쪽 띠, 가로 높은 화면은 위 띠, 세로는 양옆 띠와 사진 아래를 그 가장자리 색으로.
  const side=Math.ceil(box.left)+2,lid=Math.ceil(box.top)+2,tall=Math.ceil(box.height),under=`linear-gradient(90deg,${edges.bottom})`;
  container.style.background=layout==='landscape'
   ?(frame.dataset.fit==='wide'?`linear-gradient(180deg,${edges.left}) left top/${side}px 100% no-repeat,${under}`:`linear-gradient(90deg,${edges.top}) left top/100% ${lid}px no-repeat,${under}`)
   :`linear-gradient(90deg,${edges.top}) left top/100% ${lid}px no-repeat,linear-gradient(180deg,${edges.left}) left ${Math.floor(box.top)}px/${side}px ${tall}px no-repeat,linear-gradient(180deg,${edges.right}) right ${Math.floor(box.top)}px/${side}px ${tall}px no-repeat,${under}`;
 }
 img.addEventListener('load',readEdges);
 // 가로: 오른쪽 아래에 붙인다(그림 왼쪽의 빈 하늘이 제목·카드 자리). 세로: 위에 붙이고, 아래 카드에 동네가 가리면 그만큼만 줄인다.
 function fit(){
  const rect=container.getBoundingClientRect(),cw=rect.width,ch=rect.height;if(!cw||!ch)return;
  const scene=TOWN_SCENES[layout],ratio=scene.width/scene.height;
  let fw,fh,left,top,mode,free=ch;
  if(layout==='landscape'){
   if(cw/ch>ratio){fh=ch;fw=ch*ratio;left=cw-fw;top=0;mode='wide';}
   else{fw=cw;fh=cw/ratio;left=0;top=ch-fh;mode='tall';}
  }else{
   const edge=obstacle?.getBoundingClientRect();if(edge&&edge.height)free=Math.min(ch,edge.top-rect.top);
   compact=free-8<scene.visible*cw/ratio;const keep=compact?scene.compact:scene.visible;
   fw=Math.min(cw,Math.max(cw*.7,(free-8)/keep*ratio));fh=fw/ratio;left=(cw-fw)/2;mode=fw<cw-1?'inset':'full';
   top=Math.max(0,Math.min(56,(free-8-fh*keep)/2));
  }
  if(layout==='portrait')place('street');
  Object.assign(frame.style,{left:`${left}px`,top:`${top}px`,width:`${fw}px`,height:`${fh}px`});
  frame.dataset.fit=mode;container.style.setProperty('--town-fh',`${fh}px`);container.style.setProperty('--town-top',`${top}px`);box={left,top,width:fw,height:fh};fill();
  // 세로 안내 한 줄은 동네 바로 아래 빈 하늘에 들어갈 자리가 있을 때만 보인다.
  hint.dataset.fits=String(layout==='landscape'||top+fh*.615+(hint.offsetHeight||44)+8<=free);
 }
 function place(id){
  const base=TOWN_SCENES[layout].places[id],spot=compact&&base.alt?base.alt:base,button=buttons.get(id),zone=zones.get(id);
  button.style.left=`${spot.pin[0]}%`;button.style.top=`${spot.pin[1]}%`;
  // 가장자리 이름표는 화면 밖으로 나가지 않게 안쪽으로 붙인다.
  button.style.setProperty('--pin-x',spot.pin[0]<16?'-14%':spot.pin[0]>84?'-86%':'-50%');
  const [x,y,w,h]=spot.area;Object.assign(zone.style,{left:`${x}%`,top:`${y}%`,width:`${w}%`,height:`${h}%`});
 }
 function arrange(){
  frame.dataset.layout=layout;container.dataset.layout=layout;compact=false;
  for(const item of TOWN_PLACES)place(item.id);
  paint();fit();
 }
 function render(){
  const packs=new Map((progress?.packs||[]).map(p=>[p.id,p]));
  const loading=!progress||progress.status?.phase==='loading';
  const nowPack=loading?null:progress?.nextLesson?.packId||null;
  for(const place of TOWN_PLACES){
   const button=buttons.get(place.id),count=button.querySelector('.town-pin-count');
   if(!place.pack){button.dataset.state='door';count.textContent='';button.setAttribute('aria-label',`${place.name} 들어가기 · ${place.note}`);continue;}
   const p=packs.get(place.pack),done=p&&p.total>0&&p.completed>=p.total;
   const state=loading?'idle':nowPack===place.pack?'now':done?'done':p?.completed?'doing':'new';
   button.dataset.state=state;
   count.textContent=loading||!p||done?'':`${p.completed}/${p.total}`;
   if(done)count.innerHTML=CHECK;
   const next=state==='now'?progress?.nextLesson?.label||progress?.nextLesson?.title||'':'';
   button.setAttribute('aria-label',[place.name,state==='now'?'지금 할 차례':'',next,p?`${p.completed} / ${p.total} 레슨`:'',done?'모두 마침':''].filter(Boolean).join(' · '));
   if(next)button.title=`지금 할 차례 · ${next}`;else button.removeAttribute('title');
  }
 }
 function setTime(next=forced||townTime()){
  if(next===time)return;time=next;
  container.dataset.time=time;document.documentElement.dataset.townTime=time;
  container.setAttribute('aria-label',`세 친구가 사는 우리 동네 · ${TIME_NAMES[time]}`);
  paint();
 }
 const visible=()=>{if(!document.hidden)setTime();};
 const observer=typeof ResizeObserver==='function'?new ResizeObserver(()=>fit()):null;
 observer?.observe(container);if(obstacle)observer?.observe(obstacle);
 window.addEventListener('resize',fit);
 document.addEventListener('visibilitychange',visible);timer=setInterval(()=>setTime(),300000);
 setTime();arrange();render();
 return {
  setLayout(value){layout=value==='landscape'?'landscape':'portrait';arrange();},
  setProgress(summary){progress=summary||null;render();},
  setActive(value){active=!!value;container.inert=!active;if(active){fit();arrive();}},
  focus(){buttons.get(progress?.nextLesson?.packId?TOWN_PLACES.find(p=>p.pack===progress.nextLesson.packId)?.id:'home')?.focus({preventScroll:true});},
  dispose(){clearInterval(timer);observer?.disconnect();window.removeEventListener('resize',fit);document.removeEventListener('visibilitychange',visible);},
  metrics:()=>({layout,active,time,hint:!hint.hidden,fit:frame.dataset.fit,compact,frame:{left:Math.round(parseFloat(frame.style.left)),top:Math.round(parseFloat(frame.style.top)),width:Math.round(parseFloat(frame.style.width)),height:Math.round(parseFloat(frame.style.height))},places:TOWN_PLACES.map(p=>({id:p.id,pack:p.pack,state:buttons.get(p.id).dataset.state,count:buttons.get(p.id).querySelector('.town-pin-count').textContent}))})
 };
}
