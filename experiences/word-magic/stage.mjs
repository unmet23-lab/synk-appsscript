import {clone} from './core.mjs';
export const W=960,H=540;
const paths={
 ...Object.fromEntries(['rabbit','bear','penguin','fox','book','camera','chair','purse','swim-ring','water-bottle','umbrella','snack'].map(k=>[k,`assets/objects/${k}.webp`])),
 cream:'kit/felt/wide-cream.webp',butter:'assets/wide-butter.webp',lapis:'assets/wide-lapis.webp',coral:'assets/wide-coral.webp',
 slab:'kit/felt/slab-cream-long.webp',pink:'kit/felt/slab-blush-long.webp',tile:'kit/felt/cushion-butter-mid.webp',blue:'kit/felt/cushion-lapis-mid.webp',blush:'kit/felt/cushion-blush-mid.webp',
 mongle:'kit/brand/mongle-curious.webp',happy:'kit/brand/mongle-smile.webp',spark:'kit/felt/sparkle.webp',check:'kit/felt/badge-check.webp',badge:'kit/felt/badge-cream.webp'
 ,village:'assets/scenes/village.webp',theatre:'assets/scenes/theatre.webp',terrace:'assets/scenes/terrace.webp'
 ,chestClosed:'assets/objects/chest-closed-v2.webp',chestOpen:'assets/objects/chest-open-v2.webp'
};
export class MagicStage{
 constructor(canvas,hotspots,onSelect){this.canvas=canvas;this.pixelRatio=Math.min(2,Math.max(1.25,globalThis.devicePixelRatio||1));canvas.width=Math.round(W*this.pixelRatio);canvas.height=Math.round(H*this.pixelRatio);this.ctx=canvas.getContext('2d');this.ctx.setTransform(this.pixelRatio,0,0,this.pixelRatio,0,0);this.hotspots=hotspots;this.onSelect=onSelect;this.images={};this.objects=[];this.from=[];this.chapter=0;this.selected=null;this.solved=false;this.started=0;this.frame=0;this.look={scene:'default',frame:'cream'};this.reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;}
 appearance(look){this.look={scene:['default','sunset','night'].includes(look?.scene)?look.scene:'default',frame:['cream','coral','lapis'].includes(look?.frame)?look.frame:'cream'};this.draw(1);}
 async load(){await Promise.all(Object.entries(paths).map(([k,path])=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{this.images[k]=im;resolve();};im.onerror=()=>reject(Error(path));im.src=path;})));this.draw();}
 set(objects,{chapter=0,selected=null,solved=false,animate=true,labels={},scene=null}={}){cancelAnimationFrame(this.frame);this.from=this.objects.map(o=>clone(this.display(o)));this.objects=clone(objects);this.chapter=chapter;this.selected=selected;this.solved=solved;this.scene=scene;this.labels=labels;this.started=performance.now();this.animate=animate&&!this.reduced();this.renderHotspots();this.tick();}
 display(o){const q={...o};if(!this.solved||!this.scene)return q;const id=this.scene.id;if(id==='size-1'&&o.id==='rabbit')q.x=610;if(id==='size-4'&&o.id==='ring'){q.x=695;q.y=405;}if(id==='size-4'&&o.id==='bear')q.y=330;if(id==='size-5'&&o.id==='umbrella'){q.x=390;q.y=242;}if(id==='doors-1'&&o.id==='fox'){q.x=490;q.size=.72;}return q;}
 bounds(o){const base=['rabbit','bear','penguin','fox'].includes(o.asset)?148:o.asset==='door'?185:o.asset==='chest'?170:130;const h=base*(o.size||1),w=o.asset==='door'?h*.8:h*1.18;return {x:Math.max(8,Math.min(W-w-8,o.x-w/2)),y:Math.max(8,Math.min(H-h-8,o.y-(o.level||0)*145-h*.68)),w,h};}
 renderHotspots(){this.hotspots.replaceChildren(...this.objects.map((o,i)=>{const b=document.createElement('button'),r=this.bounds(this.display(o));b.type='button';b.className='object-hit';b.dataset.object=o.id;b.setAttribute('aria-label',this.labels[o.asset]||o.asset);b.setAttribute('aria-pressed',String(this.selected===o.id));b.style.cssText=`left:${r.x/W*100}%;top:${r.y/H*100}%;width:${r.w/W*100}%;height:${r.h/H*100}%`;b.innerHTML=`<span class="object-number">${i+1}</span>`;b.onclick=()=>this.onSelect(o.id);return b;}));}
 tick(){const t=this.animate?Math.min(1,(performance.now()-this.started)/850):1;this.draw(t);if(t<1)this.frame=requestAnimationFrame(()=>this.tick());}
 img(key,x,y,w,h,alpha=1){const im=this.images[key];if(!im)return;const c=this.ctx;c.save();c.globalAlpha=alpha;c.drawImage(im,x,y,w,h);c.restore();}
 contained(key,x,y,w,h,alpha=1){const im=this.images[key];if(!im)return;const s=Math.min(w/im.width,h/im.height);this.img(key,x+(w-im.width*s)/2,y+(h-im.height*s)/2,im.width*s,im.height*s,alpha);}
 cover(key,x,y,w,h){const im=this.images[key];if(!im)return;const ratio=Math.max(w/im.width,h/im.height),sw=w/ratio,sh=h/ratio;this.ctx.drawImage(im,(im.width-sw)/2,(im.height-sh)*.25,sw,sh,x,y,w,h);}
 shadow(x,y,w,h,strength=.2){const c=this.ctx;c.save();c.translate(x,y);c.scale(w,h);const g=c.createRadialGradient(0,0,0,0,0,1);g.addColorStop(0,`rgba(27,30,43,${strength})`);g.addColorStop(1,'rgba(27,30,43,0)');c.fillStyle=g;c.beginPath();c.arc(0,0,1,0,Math.PI*2);c.fill();c.restore();}
 panel(key,x,y,w,h,r=16){const c=this.ctx;c.save();c.beginPath();c.roundRect(x,y,w,h,r);c.clip();this.cover(key,x,y,w,h);c.restore();}
 arch(x,y,w,h){const c=this.ctx;this.shadow(x+w/2,y+h+9,w*.67,19,.22);c.save();c.beginPath();c.roundRect(x,y,w,h,[w/2,w/2,8,8]);c.roundRect(x+49,y+65,w-98,h+4,[(w-98)/2,(w-98)/2,0,0]);c.clip('evenodd');this.cover('lapis',x,y,w,h);c.restore();c.save();c.globalAlpha=.24;c.strokeStyle='#fff';c.lineWidth=3;c.beginPath();c.roundRect(x+5,y+5,w-10,h-5,[w/2,w/2,4,4]);c.stroke();c.restore();}
 backdrop(){const c=this.ctx,key=['village','theatre','terrace'][this.chapter]||'village';this.cover(key,0,0,W,H);
  if(this.look.scene!=='default'){c.fillStyle=this.look.scene==='night'?'rgba(19,37,83,.62)':'rgba(244,134,111,.2)';c.fillRect(0,0,W,H);}
  const shade=c.createLinearGradient(0,150,0,H);shade.addColorStop(0,'rgba(255,255,255,0)');shade.addColorStop(1,'rgba(255,255,255,.44)');c.fillStyle=shade;c.fillRect(0,0,W,H);
  this.shadow(W/2,482,478,42,.25);
  // One tangible workbench: a photographed felt top, a separate front edge and a contact shadow.
  const edge=this.look.scene==='sunset'?'coral':this.look.scene==='night'?'lapis':['butter','lapis','coral'][this.chapter];
  c.save();c.beginPath();c.moveTo(133,278);c.lineTo(827,278);c.lineTo(942,488);c.quadraticCurveTo(960,508,925,514);c.lineTo(35,514);c.quadraticCurveTo(0,508,18,488);c.closePath();c.clip();this.cover(edge,0,270,W,255);c.restore();
  c.save();c.beginPath();c.moveTo(136,258);c.lineTo(824,258);c.quadraticCurveTo(834,258,840,270);c.lineTo(937,468);c.quadraticCurveTo(950,487,927,491);c.lineTo(33,491);c.quadraticCurveTo(10,487,23,468);c.lineTo(120,270);c.quadraticCurveTo(126,258,136,258);c.closePath();c.clip();this.cover('cream',0,250,W,250);const light=c.createLinearGradient(0,250,W,490);light.addColorStop(0,'rgba(255,255,255,.38)');light.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=light;c.fillRect(0,250,W,260);c.restore();
 }
 object(o,t=1,{ghost=false}={}){
  const old=this.from.find(p=>p.id===o.id),ease=1-Math.pow(1-t,3);let q={...o};if(old&&t<1){for(const key of ['size','level','x','y'])q[key]=old[key]+(o[key]-old[key])*ease;}
  const c=this.ctx,r=this.bounds(q),selected=this.selected===o.id&&!ghost;
  if(!ghost)this.shadow(r.x+r.w*.51,r.y+r.h*.97,r.w*.58,Math.max(7,r.h*.09),.21);
  if(selected){c.save();c.globalAlpha=.7;this.img('pink',r.x-12,r.y+r.h*.9,r.w+24,26,.85);c.restore();}
  if(q.asset==='door'){
   this.shadow(r.x+r.w*.6,r.y+r.h,r.w*.64,16,.3);this.panel('lapis',r.x-15,r.y-16,r.w+30,r.h+30,14);this.panel('cream',r.x-3,r.y-5,r.w+6,r.h+8,8);c.fillStyle='#1b2b4c';c.fillRect(r.x+4,r.y+3,r.w-8,r.h-4);
   this.contained('happy',r.x+9,r.y+25,r.w-18,r.h-40,1);
   let openness=q.open?1:0;if(old&&t<1)openness=(old.open?1:0)+((q.open?1:0)-(old.open?1:0))*ease;
   const leaf=Math.max(19,r.w*(1-openness*.83));c.save();c.transform(1,-openness*.22,0,1,r.x,r.y+openness*r.w*.22);this.panel('butter',0,0,leaf,r.h,7);this.panel('cream',8,13,Math.max(4,leaf-16),r.h*.35,5);this.panel('cream',8,r.h*.49,Math.max(4,leaf-16),r.h*.4,5);this.img('badge',leaf-21,r.h*.46,17,17);c.restore();
  }else if(q.asset==='chest'){
   const x=r.x+(r.w-r.h)/2,y=r.y,s=r.h,opening=old&&old.open!==q.open&&t<1;
   if(opening)this.contained(old.open?'chestOpen':'chestClosed',x,y,s,s,1-ease);
   this.contained(q.open?'chestOpen':'chestClosed',x,y,s,s,opening?ease:1);
   if(q.open){c.save();c.globalAlpha=opening?ease:1;c.beginPath();c.rect(x+s*.2,y+s*.2,s*.6,s*.38);c.clip();this.contained('penguin',x+s*.32,y+s*.16,s*.34,s*.49);c.restore();}
  }else if(q.asset==='book'&&q.open){
   this.panel('lapis',r.x-r.w*.04,r.y+r.h*.13,r.w*1.08,r.h*.75,7);
   c.save();c.translate(r.x+r.w/2,r.y+r.h*.5);c.transform(1,.045,0,1,0,0);this.panel('cream',-r.w*.48,-r.h*.30,r.w*.47,r.h*.63,3);c.transform(1,-.09,0,1,0,0);this.panel('cream',r.w*.015,-r.h*.30,r.w*.47,r.h*.63,3);c.restore();this.shadow(r.x+r.w*.5,r.y+r.h*.5,r.w*.035,r.h*.29,.16);this.contained('spark',r.x+r.w*.16,r.y+r.h*.27,r.w*.22,r.h*.22);this.contained('rabbit',r.x+r.w*.60,r.y+r.h*.28,r.w*.19,r.h*.34);
  }else this.contained(q.asset,r.x,r.y,r.w,r.h,ghost?.35:1);
 }
 draw(t=1){const c=this.ctx;c.clearRect(0,0,W,H);c.fillStyle='#fff';c.fillRect(0,0,W,H);this.backdrop();
  // The distant world stays fixed for both listening answers; only intended objects transform.
  if(this.chapter===2){this.shadow(531,450,255,18,.16);this.panel('lapis',289,272,475,16,5);this.panel('cream',280,258,490,17,5);this.panel('lapis',289,423,475,16,5);this.panel('cream',280,409,490,17,5);this.panel('lapis',295,272,15,153,4);this.panel('lapis',745,272,15,153,4);}
  if(this.chapter===0&&this.scene?.id==='size-1')this.arch(384,169,173,244);
  if(this.chapter===1){this.contained('spark',81,82,65,65);}
  const id=this.scene?.id,ease=1-Math.pow(1-t,3);let actorX=30,actorY=336;
  if(this.solved&&id==='size-1')actorX=30+750*ease;
  if(id==='size-2'){this.panel('lapis',374,221,184,14,4);this.panel('cream',370,207,190,18,5);this.contained('camera',430,145,85,85);if(this.solved){actorX=390;actorY=190;}}
  if(this.solved&&id==='size-3'){actorX=400;actorY=290;}
  if(this.solved&&id==='size-5'){actorX=315;actorY=303;}
  if(!(this.solved&&id==='size-1')){this.shadow(actorX+85,actorY+155,61,12,.17);this.contained(this.solved?'happy':'mongle',actorX,actorY,174,170);}
  for(const o of [...this.objects].sort((a,b)=>b.level-a.level))this.object(this.display(o),t);
  if(this.solved&&id==='size-1')this.contained('happy',actorX,actorY,174,170);
  if(id==='doors-5'&&this.solved){this.contained('rabbit',633,220,95,112);this.contained('spark',725,247,50,50);}
  if(this.solved&&['size-6','doors-6','sky-6'].includes(id)){this.contained('fox',110,310,140,150);this.contained('penguin',765,340,120,130);this.contained('camera',453,365,80,70);}
  if(this.solved){this.contained('check',817,36,96,96);if(!id)this.contained('happy',762,300,150,170);}
 }
 goal(canvas,scene){const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);const saved=this.ctx,from=this.from,sel=this.selected;this.ctx=ctx;this.from=[];this.selected=null;const objects=scene.goals.map((g,i)=>{const o=clone(scene.objects.find(x=>x.id===g.id));o[g.property]=g.value;o.x=70+i*145;o.y=102;o.size=g.property==='size'?(g.value<1?.55:.8):.6;o.level=0;if(g.property==='level'){o.size=.36;o.y=g.value===1?40:107;this.img('slab',o.x-43,56,86,12);this.img('slab',o.x-43,123,86,12);}return o;});for(const o of objects)this.object(o);this.ctx=saved;this.from=from;this.selected=sel;}
 async photo(){this.draw(1);const c=document.createElement('canvas');c.width=W;c.height=H+72;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);const frame=this.images[this.look.frame];if(frame)x.drawImage(frame,0,0,c.width,c.height);x.drawImage(this.canvas,24,24,W-48,(W-48)*H/W);x.fillStyle='#fff';x.fillRect(24,H+8,W-48,40);x.fillStyle='#111';x.font='600 24px SUIT';x.fillText('SYNK WORLD · 말의 마법사',42,H+37);return new Promise(resolve=>c.toBlob(resolve,'image/png'));}
}
