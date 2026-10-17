// WORLD 움직임(2026-10-17 유호님 「시안에 있는 움직임 전부 앱에 넣어 줘」 — 「WORLD 움직임 시안」 페이지, 기록은 월드 시그널 가이드 「움직임」 절).
// 10-15 유호님이 「잘 만들면 멀미는 안 날 거야」로 예전의 움직임 금지를 지웠다. 기준은 질: 회전·빠른 떨림·늘 도는 흔들림은 쓰지 않고, 자리를 크게 옮기지 않는다.
// 기기 「동작 줄이기」와 WORLD 「움직임 줄이기」(:root[data-motion=reduced])에서는 모두 멈춘다.
// 글은 처음부터 DOM에 그대로 있다(읽기 프로그램·textContent가 바뀌지 않게). 숫자 굴림의 띠·도장 글씨는 의사 요소·캔버스로 그린다.

const FRIEND_KEYS={marine:'marin'};
export const motionOn=()=>{
 if(typeof document==='undefined'||typeof matchMedia!=='function')return false;
 if(document.documentElement?.dataset?.motion==='reduced')return false;
 return !matchMedia('(prefers-reduced-motion: reduce)').matches;
};
const EASE='cubic-bezier(.22,.7,.2,1)',SPRING='cubic-bezier(.3,1.35,.45,1)';
const animate=(el,frames,opts)=>el&&typeof el.animate==='function'?el.animate(frames,opts):null;
export const spring=(el,frames,opts={})=>motionOn()?animate(el,frames,{easing:'cubic-bezier(.25,.9,.3,1)',fill:'backwards',...opts}):null;

/** 잉크 스미기: 굵기가 얇게 떴다가 차오르며 또렷해진다(가변 SUIT만, 자리는 그대로). */
export function ink(el,{from=200,delay=0,duration=950}={}){
 if(!el||!motionOn())return;const weight=getComputedStyle(el).fontWeight;
 animate(el,[{fontWeight:from,opacity:.2,filter:'blur(3px)'},{fontWeight:weight,opacity:1,filter:'blur(0px)'}],{duration,delay,easing:EASE,fill:'backwards'});
}

/** 영문 라벨 타이핑: 글자는 그대로 두고 하나씩 보이게, 뒤 선(::after)은 다 찍힌 뒤 그어진다. */
export function typeLabel(el,{delay=0}={}){
 if(!el||!motionOn()||el.dataset.wTyped)return;el.dataset.wTyped='1';
 const nodes=[...el.childNodes].filter(n=>n.nodeType===3);if(!nodes.length)return;
 const chars=[];
 // 글자들을 한 덩어리(run)로 묶는다 — 라벨이 flex여도 글자마다 따로 놓이지 않게.
 for(const node of nodes){const run=document.createElement('span');run.className='w-type-run';for(const ch of node.textContent){const s=document.createElement('span');s.className='w-type-c';s.textContent=ch;run.append(s);chars.push(s);}node.replaceWith(run);}
 const caret=document.createElement('i');caret.className='w-caret';caret.setAttribute('aria-hidden','true');
 el.classList.add('w-typing');let i=0;
 const step=()=>{if(!el.isConnected)return;if(i<chars.length){chars[i].classList.add('is-on');chars[i].after(caret);i++;setTimeout(step,30+Math.random()*24);}else setTimeout(()=>{caret.remove();el.classList.remove('w-typing');},240);};
 setTimeout(()=>{if(!el.isConnected)return;chars[0]?.before(caret);setTimeout(step,110);},delay);
}

/** 친구 말투 글자: 몽글은 낱말씩 번지고, 까몽은 글자마다 톡, 마린은 신호를 해독하듯 왼쪽부터 맞춰진다. */
export function talk(el,text,friend,{delay=0}={}){
 if(!el)return;const who=FRIEND_KEYS[friend]||friend;el.textContent=text;
 if(!motionOn()||!text)return;
 el.textContent='';const words=String(text).split(' ');
 if(who==='mongle'){
  words.forEach((w,i)=>{if(i)el.append(' ');const s=document.createElement('span');s.className='w-talk-w';s.textContent=w;el.append(s);
   animate(s,[{opacity:0,filter:'blur(6px)',transform:'translateY(3px)'},{opacity:1,filter:'blur(0px)',transform:'none'}],{duration:460,delay:delay+i*85,easing:EASE,fill:'backwards'});});
  return;
 }
 if(who==='kkamong'){let n=0;
  words.forEach((w,i)=>{if(i)el.append(' ');const s=document.createElement('span');s.className='w-talk-w';
   for(const ch of w){const c=document.createElement('span');c.className='w-talk-c';c.textContent=ch;s.append(c);
    animate(c,[{opacity:0,transform:'translateY(7px) scale(.4)'},{opacity:1,transform:'translateY(-2px) scale(1.14)',offset:.6},{opacity:1,transform:'none'}],{duration:320,delay:delay+n*30,easing:'cubic-bezier(.3,.8,.3,1)',fill:'backwards'});n++;}
   el.append(s);});
  return;
 }
 // 마린: 글자 자리는 처음부터 잡혀 있고 아직 안 맞춰진 칸만 기호(::after)를 보인다.
 const pool=[...new Set(String(text).replace(/\s/g,''))].concat(['▮','▯','·']);const cells=[];
 words.forEach((w,i)=>{if(i)el.append(' ');const s=document.createElement('span');s.className='w-talk-w';
  for(const ch of w){const c=document.createElement('span');c.className='w-dc is-wait';c.textContent=ch;s.append(c);cells.push(c);}el.append(s);});
 const start=performance.now()+delay,per=24,win=7;
 const frame=now=>{if(!el.isConnected)return;const k=Math.max(0,(now-start)/per);
  cells.forEach((c,i)=>{if(i<k-win)c.className='w-dc';else if(i<k){c.className='w-dc is-scramble';if(Math.random()<.45)c.dataset.g=pool[(Math.random()*pool.length)|0];}});
  if(k<cells.length+win)requestAnimationFrame(frame);else cells.forEach(c=>{c.className='w-dc';delete c.dataset.g;});};
 requestAnimationFrame(frame);
}

/** 숫자 굴림: 숫자는 글자 그대로 두고(투명), 그 위에 0~9 띠(::before)를 굴린다. */
export function roll(el,{delay=0,duration=1000}={}){
 if(!el||!motionOn()||el.dataset.wRolled)return;el.dataset.wRolled='1';
 const nodes=[];const walk=n=>{for(const c of [...n.childNodes]){if(c.nodeType===3)nodes.push(c);else if(c.nodeType===1)walk(c);}};walk(el);
 let k=0;
 for(const node of nodes){
  if(!/\d/.test(node.textContent))continue;const frag=document.createDocumentFragment();
  for(const ch of node.textContent){
   if(!/\d/.test(ch)){frag.append(ch);continue;}
   const d=document.createElement('span');d.className='w-roll';d.style.setProperty('--d',ch);
   const t=document.createElement('span');t.className='w-roll-t';t.textContent=ch;const strip=document.createElement('i');strip.setAttribute('aria-hidden','true');strip.style.setProperty('--rd',`${delay+k*120}ms`);strip.style.setProperty('--rt',`${duration+k*160}ms`);
   d.append(t,strip);frag.append(d);k++;
  }
  node.replaceWith(frag);
 }
}

/** 누르면 말랑: 눌렸다가 탱 하고 돌아온다(바닥 기준, 회전 없음). */
export function squish(el){
 if(!el||!motionOn())return;
 animate(el,[{scale:'1 1'},{scale:'1.1 .86',offset:.18},{scale:'.95 1.08',offset:.42},{scale:'1.02 .98',offset:.68},{scale:'1 1'}],{duration:640,easing:'cubic-bezier(.3,.7,.3,1)'});
}

/** 단추 젤리: 누르면 쏙 들어갔다가 놓으면 통 튀어나온다. base는 단추가 원래 가진 transform(이름표처럼 자리 잡기에 쓰는 경우). */
export function bindPress(root,selector,{base=()=>'',target=b=>b}={}){
 if(!root)return()=>{};let held=null;
 const down=event=>{const hit=event.target.closest?.(selector);if(!hit||!root.contains(hit)||hit.disabled||!motionOn())return;const b=target(hit);if(!b)return;
  held?.anim?.cancel();const t=base(b);held={b,t,anim:animate(b,[{transform:`${t} scale(1)`},{transform:`${t} scale(.93)`}],{duration:110,easing:'ease-out',fill:'forwards'})};};
 const up=()=>{if(!held)return;const {b,t,anim}=held;held=null;
  animate(b,[{transform:`${t} scale(.93)`},{transform:`${t} scale(1.05)`,offset:.45},{transform:`${t} scale(.985)`,offset:.75},{transform:`${t} scale(1)`}],{duration:480,easing:'cubic-bezier(.3,.7,.3,1)'});anim?.cancel();};
 root.addEventListener('pointerdown',down);for(const t of ['pointerup','pointercancel','pointerleave'])root.addEventListener(t,up);
 return()=>{root.removeEventListener('pointerdown',down);for(const t of ['pointerup','pointercancel','pointerleave'])root.removeEventListener(t,up);};
}

/** 참 잘했어요 도장(캔버스에 그려 글자가 화면 글로 섞이지 않게). host 안 오른쪽 위에 찍힌다. */
export function stamp(host,{size=104,rot=-12,top=null,right=null,left=null,bottom=null,shake=null,delay=0}={}){
 if(!host||!motionOn())return null;
 const c=document.createElement('canvas');c.className='w-stamp';c.setAttribute('aria-hidden','true');const px=Math.round(size*2);c.width=c.height=px;
 Object.assign(c.style,{width:`${size}px`,height:`${size}px`});for(const [k,v] of Object.entries({top,right,left,bottom}))if(v!=null)c.style[k]=typeof v==='number'?`${v}px`:v;
 const g=c.getContext('2d');if(g){const r=px/2,ink='#EC4A3C';g.strokeStyle=ink;g.fillStyle=ink;g.lineWidth=px*.04;g.beginPath();g.arc(r,r,r*.9,0,Math.PI*2);g.stroke();g.lineWidth=px*.013;g.beginPath();g.arc(r,r,r*.76,0,Math.PI*2);g.stroke();
  const font=`800 ${Math.round(px*.2)}px 'World SUIT','Apple SD Gothic Neo','Malgun Gothic',sans-serif`;g.font=font;g.textAlign='center';g.textBaseline='middle';g.fillText('참',r,r*.8);g.font=`800 ${Math.round(px*.16)}px 'World SUIT','Apple SD Gothic Neo','Malgun Gothic',sans-serif`;g.fillText('잘했어요',r,r*1.27);}
 if(getComputedStyle(host).position==='static')host.style.position='relative';
 host.append(c);c.style.transform=`rotate(${rot}deg)`;
 animate(c,[{opacity:0,transform:`scale(2.3) rotate(${rot-16}deg)`},{opacity:1,transform:`scale(.9) rotate(${rot}deg)`,offset:.55},{transform:`scale(1.05) rotate(${rot}deg)`,offset:.75},{transform:`scale(1) rotate(${rot}deg)`}],{duration:520,delay,easing:'cubic-bezier(.5,0,.3,1)',fill:'backwards'});
 if(shake)setTimeout(()=>animate(shake,[{transform:'none'},{transform:'translate(2px,1px)'},{transform:'translate(-2px,-1px)'},{transform:'none'}],{duration:150}),delay+280);
 return c;
}

/** 펠트 색종이: host 위에 캔버스를 깔고 한 번 터진다(약 3초 뒤 스스로 지운다). */
export function confetti(host,{x=.5,y=.3,count=84,delay=0}={}){
 if(!host||!motionOn())return;
 const box=host.getBoundingClientRect();if(!box.width||!box.height)return;
 const dpr=Math.min(2,window.devicePixelRatio||1),W=Math.round(box.width*dpr),H=Math.round(box.height*dpr);
 const cv=document.createElement('canvas');cv.className='w-confetti';cv.setAttribute('aria-hidden','true');cv.width=W;cv.height=H;host.append(cv);const g=cv.getContext('2d');if(!g){cv.remove();return;}
 const C=['#F96859','#F5C445','#7DB45A','#5B86DB','#F4E9DC','#8B5E3C','#FFB4A9'],s=dpr;
 const ps=Array.from({length:count},()=>{const a=-Math.PI/2+(Math.random()-.5)*1.9,v=(450+Math.random()*450)*s;return {x:W*x+(Math.random()-.5)*60*s,y:H*y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,w:(7+Math.random()*8)*s,h:(4.5+Math.random()*5)*s,r:Math.random()*6.28,vr:(Math.random()-.5)*12,c:C[(Math.random()*C.length)|0],round:Math.random()<.35,flip:Math.random()*6.28};});
 let t0=null,last=null;
 const step=now=>{if(!cv.isConnected)return;if(t0===null){t0=now;last=now;}const dt=Math.min(.033,(now-last)/1000);last=now;const age=(now-t0)/1000;g.clearRect(0,0,W,H);
  for(const p of ps){p.vy+=900*s*dt;p.vx*=Math.pow(.18,dt);p.vy*=Math.pow(.45,dt);p.x+=p.vx*dt;p.y+=p.vy*dt;p.r+=p.vr*dt;p.flip+=dt*7;
   g.save();g.globalAlpha=Math.max(0,Math.min(1,(3.2-age)/.8));g.translate(p.x,p.y);g.rotate(p.r);g.scale(1,.35+.65*Math.abs(Math.cos(p.flip)));g.fillStyle=p.c;g.beginPath();
   if(p.round)g.arc(0,0,p.w*.42,0,6.283);else{const w=p.w,h=p.h,q=2*s;g.moveTo(-w/2+q,-h/2);g.arcTo(w/2,-h/2,w/2,h/2,q);g.arcTo(w/2,h/2,-w/2,h/2,q);g.arcTo(-w/2,h/2,-w/2,-h/2,q);g.arcTo(-w/2,-h/2,w/2,-h/2,q);}
   g.fill();g.globalAlpha*=.22;g.strokeStyle='#000';g.lineWidth=s;g.stroke();g.restore();}
  if(age<3.4)requestAnimationFrame(step);else cv.remove();};
 setTimeout(()=>requestAnimationFrame(step),delay);
}

/** 바느질 테두리: 둥근 카드 둘레를 실처럼 꿰매며 그린다(점선이 마스크로 드러난다). */
export function stitch(el,{color='rgba(249,104,89,.92)',delay=300,duration=1500,radius=null}={}){
 if(!el||!motionOn()||el.querySelector(':scope>.w-stitch'))return;
 const w=el.offsetWidth,h=el.offsetHeight;if(!w||!h)return;const r=radius??(parseFloat(getComputedStyle(el).borderTopLeftRadius)||20),q=1.5,id=`w-st-${Math.random().toString(36).slice(2,8)}`;
 const d=`M${r} ${q}H${w-r}A${r-q} ${r-q} 0 0 1 ${w-q} ${r}V${h-r}A${r-q} ${r-q} 0 0 1 ${w-r} ${h-q}H${r}A${r-q} ${r-q} 0 0 1 ${q} ${h-r}V${r}A${r-q} ${r-q} 0 0 1 ${r} ${q}Z`;
 const NS='http://www.w3.org/2000/svg',svg=document.createElementNS(NS,'svg');svg.setAttribute('class','w-stitch');svg.setAttribute('aria-hidden','true');svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
 svg.innerHTML=`<defs><mask id="${id}" maskUnits="userSpaceOnUse"><path d="${d}" fill="none" stroke="#fff" stroke-width="6" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"/></mask></defs><path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-dasharray="7 6" mask="url(#${id})"/>`;
 el.classList.add('w-stitched');el.append(svg);
 animate(svg.querySelector('mask path'),[{strokeDashoffset:100},{strokeDashoffset:0}],{duration,delay,easing:'cubic-bezier(.45,.05,.3,1)',fill:'both'});
}

/** 인화지 툭 놓기: 위에서 떨어져 비스듬히 놓인다. base는 그 사진이 원래 가진 기울기. */
export function drop(el,{base='rotate(-3deg)',delay=500}={}){
 spring(el,[{opacity:0,transform:`translate(18px,-46px) rotate(-14deg) scale(1.18)`},{opacity:1,transform:`translate(0,3px) rotate(2deg) scale(.98)`,offset:.62},{transform:`rotate(-.6deg) scale(1.01)`,offset:.82},{transform:base}],{duration:900,delay,easing:'cubic-bezier(.35,.05,.25,1)'});
}
/** 인화지 현상: 하얗게 떴다가 즉석 사진처럼 색이 올라온다. */
export function develop(el,{delay=400}={}){
 if(!el||!motionOn())return;animate(el,[{filter:'brightness(2.1) saturate(0) contrast(.45) blur(5px)'},{filter:'brightness(1.35) saturate(.35) contrast(.8) blur(1.5px)',offset:.45},{filter:'none'}],{duration:2200,delay,easing:'cubic-bezier(.3,.5,.3,1)',fill:'backwards'});
}
/** 손가락 따라 기울기: surface를 문지르면 target이 그쪽으로 기울고 빛이 돈다. */
export function bindTilt(surface,target,{base='rotate(-3deg)',max=16}={}){
 if(!surface||!target)return;
 const move=event=>{if(!motionOn())return;const r=target.getBoundingClientRect(),nx=Math.max(-1,Math.min(1,((event.clientX-r.left)/r.width-.5)*2)),ny=Math.max(-1,Math.min(1,((event.clientY-r.top)/r.height-.5)*2));
  target.classList.add('w-tilting');target.style.transition='transform .08s linear';target.style.transform=`perspective(600px) ${base} rotateY(${nx*max}deg) rotateX(${-ny*max}deg) translateZ(10px)`;target.style.setProperty('--gx',`${50+nx*45}%`);target.style.setProperty('--gy',`${50+ny*45}%`);};
 const leave=()=>{if(!target.classList.contains('w-tilting'))return;target.classList.remove('w-tilting');target.style.transition='transform .7s cubic-bezier(.3,1.5,.4,1)';target.style.transform='';};
 surface.addEventListener('pointermove',move);surface.addEventListener('pointerdown',move);for(const t of ['pointerleave','pointerup','pointercancel'])surface.addEventListener(t,leave);
}
/** 고른 답: 맞으면 손끝 자리에서 초록이 번지고, 틀리면 살짝 도리도리. */
export function wash(button,point){
 if(!button||!motionOn())return;const r=button.getBoundingClientRect(),x=point?((point.x-r.left)/r.width*100):50,y=point?((point.y-r.top)/r.height*100):50;
 const tx=Number.isFinite(x)?Math.max(0,Math.min(100,x)):50,ty=Number.isFinite(y)?Math.max(0,Math.min(100,y)):50;
 // 번짐은 단추 안에서만: 단추가 자리 기준(position)이 아니면 화면 전체가 초록으로 덮인다.
 if(getComputedStyle(button).position==='static')button.style.position='relative';button.style.isolation='isolate';button.style.overflow='hidden';
 const w=document.createElement('span');w.className='w-wash';w.setAttribute('aria-hidden','true');button.prepend(w);
 animate(w,[{clipPath:`circle(0px at ${tx}% ${ty}%)`},{clipPath:`circle(160% at ${tx}% ${ty}%)`}],{duration:620,easing:'cubic-bezier(.2,.7,.2,1)',fill:'forwards'});
}
export function shake(el){if(!el||!motionOn())return;animate(el,[{transform:'none'},{transform:'translateX(-8px)'},{transform:'translateX(7px)'},{transform:'translateX(-5px)'},{transform:'translateX(3px)'},{transform:'none'}],{duration:440,easing:'ease-out'});}
/** 누르면 불빛: 그 자리에 따뜻한 빛이 번졌다 사라진다. */
export function glow(host,x,y,{size=190}={}){
 if(!host||!motionOn())return;const g=document.createElement('span');g.className='w-glow';g.setAttribute('aria-hidden','true');Object.assign(g.style,{left:`${x}%`,top:`${y}%`,width:`${size}px`,height:`${size}px`,margin:`${-size/2}px 0 0 ${-size/2}px`});host.append(g);
 const a=animate(g,[{opacity:0,transform:'scale(.35)'},{opacity:1,transform:'scale(1)',offset:.35},{opacity:0,transform:'scale(1.35)'}],{duration:1300,easing:'cubic-bezier(.2,.7,.3,1)'});if(a)a.onfinish=()=>g.remove();else g.remove();
}
/** 차례로 켜짐: 여러 개가 톡톡(크기만). base는 각자 원래 transform. */
export function popIn(list,{delay=300,gap=90,base=()=>''}={}){
 if(!motionOn())return;[...list].forEach((el,i)=>{const t=base(el);spring(el,[{opacity:0,transform:`${t} scale(.55)`},{opacity:1,transform:`${t} scale(1.08)`,offset:.6},{transform:`${t} scale(1)`}],{duration:540,delay:delay+i*gap});});
}
/** 큰 글자 쾅(결과): 한 글자씩 찍히고 마지막 「!」는 더 세게. 낱말은 줄에서 끊기지 않는다. */
export function slam(el,{delay=300,shakeEl=null}={}){
 if(!el||!motionOn()||el.dataset.wSlam)return;el.dataset.wSlam='1';let k=0,lastDelay=0;
 const walk=node=>{for(const c of [...node.childNodes]){if(c.nodeType===1){walk(c);continue;}if(c.nodeType!==3)continue;const frag=document.createDocumentFragment();
  String(c.textContent).split(/(\s+)/).forEach(part=>{if(!part)return;if(/^\s+$/.test(part)){frag.append(part);return;}const word=document.createElement('span');word.className='w-slam-w';
   for(const ch of part){const s=document.createElement('span');s.className='w-slam-c';s.textContent=ch;word.append(s);const big=ch==='!';lastDelay=delay+k*(big?110:65);
    animate(s,[{opacity:0,transform:`scale(${big?2.6:1.9})`,filter:'blur(4px)'},{opacity:1,transform:'scale(.92)',filter:'blur(0px)',offset:.55},{transform:'scale(1.04)',offset:.78},{transform:'scale(1)'}],{duration:big?560:420,delay:lastDelay,easing:'cubic-bezier(.5,0,.3,1)',fill:'backwards'});k++;}
   frag.append(word);});c.replaceWith(frag);}};
 walk(el);
 if(shakeEl)setTimeout(()=>animate(shakeEl,[{transform:'none'},{transform:'translate(0,3px)'},{transform:'translate(0,-2px)'},{transform:'none'}],{duration:170}),lastDelay+300);
}
/** 고른 칸 알약 미끄러짐: 옛 칸 자리에서 새 칸으로 알약 하나가 미끄러진다(FLIP). from은 옛 칸의 화면 좌표. */
export function slidePill(group,to,from,{className='w-slide-pill'}={}){
 if(!group||!to||!from||!motionOn())return;
 const g=group.getBoundingClientRect(),b=to.getBoundingClientRect();if(!b.width)return;
 const pill=document.createElement('span');pill.className=className;pill.setAttribute('aria-hidden','true');
 const color=getComputedStyle(to).backgroundColor;pill.style.background=color;pill.style.borderRadius=getComputedStyle(to).borderRadius;
 Object.assign(pill.style,{left:`${b.left-g.left}px`,top:`${b.top-g.top}px`,width:`${b.width}px`,height:`${b.height}px`});
 group.classList.add('w-sliding');group.prepend(pill);
 const dx=from.left-b.left,dy=from.top-b.top,sx=from.width/b.width;
 const a=animate(pill,[{transform:`translate(${dx}px,${dy}px) scaleX(${sx})`},{transform:'none'}],{duration:480,easing:SPRING});
 const done=()=>{pill.remove();group.classList.remove('w-sliding');};if(a)a.onfinish=done;else done();
}
/** 깜빡임: 가만히 있을 때 3~5초마다 눈 감은 사진으로 0.14초. setTimeout 하나만 걸어 둔다(꺼지면 0개). */
export function createBlink({set,isIdle=()=>true}){
 let timer=0;
 const stop=()=>{clearTimeout(timer);timer=0;};
 const start=()=>{stop();if(!motionOn())return;timer=setTimeout(()=>{timer=0;if(motionOn()&&isIdle()){set('잔잔감음');setTimeout(()=>{if(isIdle())set('기본');},140);}start();},2800+Math.random()*2400);};
 return {start,stop,get pending(){return !!timer;}};
}
/** 빛 알갱이: 큰 사진 위로 작은 빛이 천천히 떠오른다(캔버스 하나, 숨으면 멈춤). */
export function dust(host,{count=22,after=null}={}){
 if(!host||!motionOn())return()=>{};
 const cv=document.createElement('canvas');cv.className='w-dust';cv.setAttribute('aria-hidden','true');if(after)after.after(cv);else host.append(cv);const g=cv.getContext('2d');let raf=0,ps=[],W=0,H=0,last=0;
 const size=()=>{const r=host.getBoundingClientRect(),d=Math.min(2,window.devicePixelRatio||1);W=cv.width=Math.max(1,Math.round(r.width*d));H=cv.height=Math.max(1,Math.round(r.height*d));ps=Array.from({length:count},()=>({x:Math.random()*W,y:H*(.25+Math.random()*.7),r:(1+Math.random()*2.3)*d,v:(5+Math.random()*11)*d,p:Math.random()*6.28,a:.35+Math.random()*.45}));};
 const draw=now=>{if(!cv.isConnected)return;const dt=Math.min(.05,((now-(last||now))/1000));last=now;if(document.hidden||!motionOn()){raf=requestAnimationFrame(draw);g.clearRect(0,0,W,H);return;}g.clearRect(0,0,W,H);
  for(const q of ps){q.y-=q.v*dt;q.p+=dt*.9;q.x+=Math.sin(q.p)*.25;if(q.y<H*.12){q.y=H*(.75+Math.random()*.2);q.x=Math.random()*W;}const tw=.55+.45*Math.sin(q.p*1.7),grad=g.createRadialGradient(q.x,q.y,0,q.x,q.y,q.r*3);grad.addColorStop(0,`rgba(255,250,240,${q.a*tw})`);grad.addColorStop(.35,`rgba(255,236,214,${q.a*tw*.5})`);grad.addColorStop(1,'rgba(255,230,210,0)');g.fillStyle=grad;g.beginPath();g.arc(q.x,q.y,q.r*3,0,6.283);g.fill();}
  raf=requestAnimationFrame(draw);};
 if(g){size();raf=requestAnimationFrame(draw);}
 return()=>{cancelAnimationFrame(raf);cv.remove();};
}
