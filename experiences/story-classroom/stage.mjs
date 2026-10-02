// Generated tactile props on a miniature backdrop. Approved character images are unmodified.
const names={marin:'마린',kkamong:'까몽',teacher:'선생님',snacks:'과자',paper:'종이',cake:'케이크',ribbon:'리본',flowers:'꽃',letter:'편지',box:'상자',drawer:'서랍',table:'책상',bin:'쓰레기통',shelf:'선반',board:'칠판'};
const FLOOR={snacks:[45,82,10],paper:[30,92,11],cake:[67,85,11],flowers:[53,75,9],letter:[59,94,8],ribbon:[83,93,10]};
const TARGETS={box:[20,66,14],drawer:[35,62,12],table:[73,70,26],bin:[89,79,9],shelf:[13,45,11],board:[51,32,16]};
const ACTORS={marin:[44,74,13],kkamong:[59,75,15],teacher:[88,53,9]};
const BOARD_ART='<svg viewBox="0 0 180 160" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d="M29 40h122v80H29z" fill="none" stroke="#f5dfa4" stroke-width="2" opacity=".65"/><path d="m20 32 17 0M20 32v17M160 32h-17M160 32v17M20 128h17M20 128v-17M160 128h-17M160 128v-17" fill="none" stroke="#fff2cb" stroke-width="4"/></svg>';
export const ART={...Object.fromEntries(['box','drawer','table','bin','shelf','snacks','paper','cake','ribbon','flowers','letter'].map(id=>[id,`<img src="./assets/prop-${id}.webp" alt="" draggable="false">`])),board:BOARD_ART};
export {names};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
export class StoryStage {
 constructor(el,callbacks){this.el=el;this.callbacks=callbacks;this.nodes={};this.positions={};this.actorPositions=structuredClone(ACTORS);this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;this.busy=false;this.drag=null;this.mount();}
 mount(){
  this.el.innerHTML='<div class="stage-floor-glow" aria-hidden="true"></div><div class="stage-effect" aria-hidden="true"></div><div class="stage-caption" aria-live="polite"></div>';
  for(const [id,pos] of Object.entries(TARGETS)){const b=this.button('scene-target',id,pos,ART[id],names[id]);b.dataset.destination=id;b.addEventListener('click',()=>this.callbacks.onPlace(id));}
  for(const [id,pos] of Object.entries(FLOOR)){const b=this.button('scene-prop',id,pos,ART[id],names[id]);b.dataset.object=id;b.addEventListener('click',()=>{if(!this.justDragged)this.callbacks.onObject(id);});this.installDrag(b,id);}
  for(const [id,pos] of Object.entries(ACTORS)){const b=this.button(`scene-actor ${id}`,id,pos,`<img class="actor-body" src="./assets/${id==='teacher'?'teacher.webp':id+'-body.webp'}" alt="" draggable="false">`,names[id]);b.dataset.actor=id;if(id==='teacher'){b.tabIndex=-1;b.disabled=true;b.style.pointerEvents='none';b.classList.add('offstage');}else b.addEventListener('click',()=>this.callbacks.onActor(id));}
 }
 button(cls,id,pos,art,label){const b=document.createElement('button');b.type='button';b.className=cls;b.setAttribute('aria-label',label);b.dataset.id=id;b.innerHTML=`<span class="art">${art}</span><span class="scene-label">${label}</span>`;this.setPosition(b,pos);this.el.append(b);this.nodes[id]=b;return b;}
 setPosition(el,[x,y,w]){el.style.left=x+'%';el.style.top=y+'%';el.style.width=w+'%';el.style.zIndex=Math.round(y*10);}
 coordinate(id,scene){const dest=scene[id];if(!dest||dest==='floor')return [...FLOOR[id]];const p=TARGETS[dest]||FLOOR[id];const siblings=Object.keys(FLOOR).filter(k=>scene[k]===dest),i=siblings.indexOf(id),spacing=Math.max(8.5,50/Math.max(this.el.clientWidth,280)*100),offset=(i-(siblings.length-1)/2)*spacing;let y=p[1]-7;if(dest==='table')y=p[1]-22;if(dest==='board')y=p[1]-3;if(dest==='shelf')y=p[1]-4;return [Math.max(8,Math.min(92,p[0]+offset)),y,Math.min(FLOOR[id][2],dest==='board'?7:8)];}
 update(game){
  this.game=game;this.el.dataset.phase=game.phase;this.el.dataset.act=game.actIndex;
  const active=game.phase==='play'||game.phase==='review';
  for(const id of Object.keys(FLOOR)){const n=this.nodes[id],pos=this.coordinate(id,game.scene);if(!this.busy){this.setPosition(n,pos);n.style.zIndex=900+Math.round(pos[1]);this.positions[id]=pos;}n.classList.toggle('selected',game.held===id);n.classList.toggle('holding',game.held===id);n.disabled=!active||this.busy;n.setAttribute('aria-pressed',String(game.held===id));}
  for(const id of ['marin','kkamong']){const n=this.nodes[id];n.classList.toggle('selected',game.actor===id);n.setAttribute('aria-pressed',String(game.actor===id));n.disabled=!active||this.busy;n.querySelector('img').src=`./assets/${id}-${game.actor===id?'focus':'body'}.webp`;}
  for(const id of Object.keys(TARGETS)){const n=this.nodes[id];n.disabled=!active||!game.held||this.busy;n.style.pointerEvents=n.disabled?'none':'auto';n.classList.toggle('available',active&&!!game.held);n.style.zIndex=(active&&game.held?1500:0)+Math.round(TARGETS[id][1]*10);}
  this.party(game.completedIds.includes('surprise-ribbon'));
 }
 teacher(show=true){this.nodes.teacher.classList.toggle('offstage',!show);this.el.classList.toggle('teacher-present',show);if(show)this.nodes.teacher.querySelector('img').animate([{transform:'translateX(25px) rotate(3deg)',opacity:0},{transform:'translateX(0) rotate(0)',opacity:1}],{duration:this.reduced?1:700,easing:'ease-out'});}
 installDrag(button,id){
  button.addEventListener('pointerdown',e=>{if(e.button!==0||this.busy||!this.game?.actor||!['play','review'].includes(this.game.phase))return;this.drag={id,startX:e.clientX,startY:e.clientY,pointer:e.pointerId,moved:false};button.setPointerCapture(e.pointerId);});
  button.addEventListener('pointermove',e=>{const d=this.drag;if(!d||d.pointer!==e.pointerId)return;if(!d.moved&&Math.hypot(e.clientX-d.startX,e.clientY-d.startY)>9){d.moved=true;this.callbacks.onObject(id);this.ghost=document.createElement('div');this.ghost.className='drag-ghost';this.ghost.innerHTML=ART[id];document.body.append(this.ghost);}if(d.moved){e.preventDefault();this.ghost.style.left=e.clientX+'px';this.ghost.style.top=e.clientY+'px';}});
  const finish=e=>{const d=this.drag;if(!d||d.pointer!==e.pointerId)return;this.drag=null;this.ghost?.remove();this.ghost=null;if(d.moved){this.justDragged=true;const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-destination]');if(target)this.callbacks.onPlace(target.dataset.destination);setTimeout(()=>this.justDragged=false,100);}};
  button.addEventListener('pointerup',finish);button.addEventListener('pointercancel',e=>{this.drag=null;this.ghost?.remove();this.ghost=null;});
 }
 async act(actor,object,destination,result,scene){
  this.busy=true;const a=this.nodes[actor],p=this.nodes[object],target=TARGETS[destination];if(!a||!p||!target){this.busy=false;return;}
  const start=this.positions[object]||FLOOR[object],dest=this.coordinate(object,scene);a.classList.add('walking');a.querySelector('img').src=`./assets/${actor}-focus.webp`;
  const ms=this.reduced?1:390;
  a.style.transition=`left ${ms}ms ease-in-out,top ${ms}ms ease-in-out`;a.style.left=(start[0]-5)+'%';a.style.top=Math.max(57,start[1])+'%';a.style.zIndex=Math.round(Math.max(57,start[1])*10+15);await delay(ms);
  p.classList.add('carried');p.style.transition=`left ${ms+120}ms ease-in-out,top ${ms+120}ms ease-in-out,width ${ms+120}ms ease-in-out`;this.setPosition(p,[dest[0],dest[1]-6,dest[2]]);p.style.zIndex=1300;
  a.style.left=(dest[0]-5)+'%';a.style.top=Math.max(55,target[1]+5)+'%';await delay(ms+120);
  p.classList.remove('carried');this.setPosition(p,dest);p.style.zIndex=900+Math.round(dest[1]);a.classList.remove('walking');a.querySelector('img').src=`./assets/${actor}-${result.correct?'happy':'body'}.webp`;
  this.caption(result.message);
  if(result.correct)this.spark(dest);else{p.classList.add('bump');a.classList.add('bump');this.el.classList.add('oops');if(object==='paper'&&destination==='bin')this.paperBurst();setTimeout(()=>{p.classList.remove('bump');a.classList.remove('bump');this.el.classList.remove('oops');},1100);}
  const home=ACTORS[actor];a.classList.add('walking');a.style.transition=`left ${this.reduced?1:330}ms ease-in-out,top ${this.reduced?1:330}ms ease-in-out`;a.style.left=home[0]+'%';a.style.top=home[1]+'%';await delay(this.reduced?1:330);a.classList.remove('walking');a.style.zIndex=Math.round(home[1]*10);
  this.positions[object]=dest;this.busy=false;
 }
 caption(message){const el=this.el.querySelector('.stage-caption');el.textContent=message;el.classList.add('visible');clearTimeout(this.captionTimer);this.captionTimer=setTimeout(()=>el.classList.remove('visible'),4400);}
 spark([x,y]){if(this.reduced)return;const root=this.el.querySelector('.stage-effect');for(let i=0;i<9;i++){const s=document.createElement('i');s.className='celebration-dot';s.style.left=x+'%';s.style.top=y+'%';s.style.background=['#F36F63','#FFE07A','#3D6BC9','#7BA078'][i%4];root.append(s);s.animate([{transform:'translate(0,0) rotate(0)',opacity:1},{transform:`translate(${(i-4)*17}px,${-40-Math.random()*45}px) rotate(160deg)`,opacity:0}],{duration:850,easing:'ease-out'}).finished.then(()=>s.remove());}}
 paperBurst(){if(this.reduced)return;const root=this.el.querySelector('.stage-effect');for(let i=0;i<6;i++){const s=document.createElement('i');s.className='paper-strip';s.style.left='89%';s.style.top='70%';s.style.background=['#f3c3b8','#90afdd','#f7dc86'][i%3];root.append(s);s.animate([{transform:'translate(0,0) rotate(0)',opacity:1},{transform:`translate(${-30-i*25}px,${-30-i*8}px) rotate(${i*60}deg)`,opacity:0}],{duration:1700,easing:'ease-out'}).finished.then(()=>s.remove());}}
 party(show){this.el.classList.toggle('party',show);if(show&&!this.bunting){const b=document.createElement('div');b.className='party-bunting';b.setAttribute('aria-hidden','true');b.innerHTML='<span></span>'.repeat(9);this.el.append(b);this.bunting=b;}if(this.bunting)this.bunting.hidden=!show;}
 reset(){this.teacher(false);this.party(false);for(const [id,pos] of Object.entries(ACTORS)){this.setPosition(this.nodes[id],pos);this.nodes[id].style.transition='';}this.el.querySelector('.stage-caption').classList.remove('visible');}
}
