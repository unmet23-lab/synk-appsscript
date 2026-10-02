const tl=gsap.timeline({paused:true});
const at=(id,t=0)=>scenes.find(s=>s.id===id).start+t;
for(const s of scenes){const q='#'+s.id;
 tl.fromTo(q+' h1 em',{yPercent:110,opacity:0},{yPercent:0,opacity:1,duration:.42,stagger:.1,ease:'power3.out'},s.start+.05);
 tl.fromTo(q+' .chapter-line',{scaleX:0},{scaleX:1,duration:.5,ease:'power3.out'},s.start+.13);
 tl.fromTo(q+' .caption',{opacity:0,y:18},{opacity:1,y:0,duration:.3},s.start+.3);
 document.querySelector(q+' .card,'+q+' .label')&&tl.fromTo(q+' .card,'+q+' .label',{opacity:0,y:24},{opacity:1,y:0,duration:.38,stagger:.11,ease:'power3.out'},s.start+.3);
 tl.set(q+' .wipe',{scaleX:0},0);
 tl.to(q+' .wipe',{scaleX:1,duration:.16,ease:'power2.in'},s.start+s.duration-.16);
}
function pop(sel,t,d=.45){tl.fromTo(sel,{opacity:0,y:45,scale:.94},{opacity:1,y:0,scale:1,duration:d,ease:'back.out(1.15)'},t);}
function click(sel,id,offset=1.65){const t=at(id,offset);tl.fromTo(sel,{opacity:0,x:120,y:95},{opacity:1,x:0,y:0,duration:.48,ease:'power3.out'},t-.5);tl.to(sel+' svg',{scale:.77,duration:.1,yoyo:true,repeat:1},t);tl.fromTo(sel+' i',{opacity:.95,scale:.18},{opacity:0,scale:2.7,duration:.65,ease:'power2.out',immediateRender:false},t);}
function zoom(sel,id,start,crop){const [x,y,w]=crop,k=936/w,img=document.querySelector(sel+' img'),base=parseFloat(img.style.width)/1280;tl.to(img,{scale:k/base,x:-x*k-parseFloat(img.style.left),y:-y*k-parseFloat(img.style.top),duration:.7,ease:'power3.inOut'},at(id,start));}
pop('#project-reuse .folder',at('project-reuse',.3));tl.fromTo('#project-reuse .rule-file',{opacity:0,rotationX:35,y:-120},{opacity:1,rotationX:0,y:0,duration:.65,ease:'back.out(1.2)'},at('project-reuse',.65));tl.fromTo('#project-reuse .links path',{strokeDasharray:1300,strokeDashoffset:1300},{strokeDashoffset:0,duration:1.2,ease:'power2.inOut'},at('project-reuse',1.4));tl.fromTo('#project-reuse .chat-card',{opacity:0,y:80,scale:.8},{opacity:1,y:0,scale:1,duration:.45,stagger:.35,ease:'back.out(1.2)'},at('project-reuse',2));
tl.fromTo('#global .branch-row>div',{opacity:0,y:-65},{opacity:1,y:0,duration:.4,stagger:.25},at('global',.65));tl.to('#global .irrelevant',{x:9,duration:.075,yoyo:true,repeat:3},at('global',2.1));tl.fromTo('#right-scope',{clipPath:'inset(0 100% 0 0)'},{clipPath:'inset(0 0% 0 0)',duration:.55,ease:'power3.out'},at('global',3.5));
tl.fromTo('#rules mark',{opacity:0,scale:.5},{opacity:1,scale:1,duration:.4,ease:'back.out(1.8)'},at('rules',1.7));tl.fromTo('#rules .reason-note',{opacity:0,clipPath:'inset(0 100% 0 0)'},{opacity:1,clipPath:'inset(0 0% 0 0)',duration:.65,ease:'power3.out'},at('rules',2.3));
tl.fromTo('#ending .pdf-fan img',{opacity:0,y:140,rotationY:-30,rotation:5},{opacity:1,y:0,rotationY:0,rotation:0,duration:.7,stagger:.2,ease:'power3.out'},at('ending',.35));tl.fromTo('#ending .kit-tags b',{opacity:0,y:35},{opacity:1,y:0,duration:.35,stagger:.2},at('ending',1.2));tl.fromTo('#ending .solid',{scale:.8},{scale:1,duration:.5,ease:'back.out(1.3)'},at('ending',2.2));

pop('#hook .felt',.2,.6);
tl.fromTo('#record .wave i',{scaleY:.25},{scaleY:1,duration:.35,stagger:.055,yoyo:true,repeat:8,ease:'sine.inOut'},at('record',.4));
pop('#record .audio-note',at('record',.2));
tl.fromTo('#common .routes b',{opacity:0,y:-60},{opacity:1,y:0,duration:.4,stagger:.4},at('common',.2));pop('#common .merge-arrow',at('common',1.5));
pop('#prepare .notepad',at('prepare',.3));tl.fromTo('#prepare .notepad p',{backgroundColor:'#ffffff'},{backgroundColor:'#d4e4ff',duration:.5,stagger:.4},at('prepare',1.3));

pop('#result .before-notes',at('result',.25));pop('#result .compare-command',at('result',2));pop('#result .after-label',at('result',2.75));
tl.fromTo('#result .after-notes>div',{opacity:0,x:65},{opacity:1,x:0,duration:.45,stagger:.5,ease:'power3.out'},at('result',3));
tl.fromTo('#result .before-notes .match-blue,#result .before-notes .match-amber',{backgroundColor:'#ffffff'},{backgroundColor:(i)=>i===0?'#dceaff':'#ffedbc',duration:.5,stagger:1},at('result',3.5));
// Continuous screenshot plane; cursor tip, focus outline and image share coordinates.
// Cursor entry / tap / target ignition follows the installed oversized-cursor primitive.
for(const scene of scenes.filter(s=>s.camera)){
 const q='#'+scene.id,c=scene.camera,t=scene.start,D=scene.duration,A=c.actionAt||2.2,B=c.nextAt||4,C=c.confirmAt||4.65,N=A+.4;
 const world=q+' .camera-world',target=q+' .cam-target',pointer=q+' .cam-pointer';
 const wide={scale:936/1280,x:0,y:(780-720*936/1280)/2};
 const pose=r=>{const [x,y,w,h]=r,k=Math.min(936/w,780/h);return {scale:k,x:468-(x+w/2)*k,y:390-(y+h/2)*k};};
 tl.fromTo(world,wide,{...wide,duration:.01},t);
 tl.fromTo(target,{opacity:0},{opacity:1,duration:.25},t+.45);
 tl.to(world,{...pose(c.focus),duration:.75,ease:'power3.inOut'},t+.9);
 tl.fromTo(q+' .phase-focus',{backgroundColor:'#edf2fc',color:'#53647f'},{backgroundColor:'#315fbe',color:'#ffffff',duration:.25},t+.9);
 tl.fromTo(pointer,{opacity:0,x:c.point[0]+80,y:c.point[1]+70},{opacity:1,x:c.point[0]-4.75,y:c.point[1]-4.4,duration:.48,ease:'power3.out'},t+A-.55);
 tl.to(pointer+' svg',{scale:.78,duration:.1,yoyo:true,repeat:1},t+A);
 tl.fromTo(pointer+' i',{opacity:1,scale:.2},{opacity:0,scale:2.6,duration:.5,immediateRender:false},t+A);
 tl.to(target,{borderColor:'#93ffbf',duration:.18},t+A);
 tl.fromTo(q+' .phase-act',{backgroundColor:'#edf2fc',color:'#53647f'},{backgroundColor:'#315fbe',color:'#ffffff',duration:.25},t+A-.05);
 if(c.mask)tl.to(q+' .cam-mask',{opacity:0,duration:.25},t+A+.05);
 if(c.nextFocus){
  if(c.nextFile)tl.fromTo(q+' .cam-next',{opacity:0},{opacity:1,duration:.22},t+N-.05);
  tl.to(world,{...pose(c.nextFocus),duration:.6,ease:'power3.inOut'},t+N);
  const r=c.rect,n=c.nextRect;
  tl.to(target,{x:n[0]-r[0],y:n[1]-r[1],scaleX:n[2]/r[2],scaleY:n[3]/r[3],borderColor:'#79a8ff',duration:.6,ease:'power3.inOut'},t+N);
  tl.to(pointer,{x:c.nextPoint[0]-4.75,y:c.nextPoint[1]-4.4,duration:.65,ease:'power3.inOut'},t+N+.05);
  tl.to(q+' .camera-label .first,'+q+' .cam-action .first',{opacity:0,duration:.15},t+N);
  tl.fromTo(q+' .camera-label .next,'+q+' .cam-action .next',{opacity:0},{opacity:1,duration:.2},t+N+.15);
  tl.to(pointer+' svg',{scale:.78,duration:.1,yoyo:true,repeat:1},t+B);
  tl.fromTo(pointer+' i',{opacity:1,scale:.2},{opacity:0,scale:2.6,duration:.5,immediateRender:false},t+B);
  tl.to(target,{borderColor:'#93ffbf',duration:.18},t+B);
 }
 if(c.confirmPoint){
  const r=c.rect,n=c.confirmRect;
  tl.to(target,{x:n[0]-r[0],y:n[1]-r[1],scaleX:n[2]/r[2],scaleY:n[3]/r[3],borderColor:'#79a8ff',duration:.35},t+C-.4);
  tl.to(pointer,{x:c.confirmPoint[0]-4.75,y:c.confirmPoint[1]-4.4,duration:.35,ease:'power3.inOut'},t+C-.4);
  tl.to(pointer+' svg',{scale:.78,duration:.1,yoyo:true,repeat:1},t+C);
  tl.to(target,{borderColor:'#93ffbf',duration:.15},t+C);
 }
 tl.to(pointer,{opacity:0,duration:.2},t+D-.95);
 tl.to(world,{...wide,duration:.7,ease:'power3.inOut'},t+D-.85);
 tl.to(q+' .phase-wide',{backgroundColor:'#315fbe',color:'#ffffff',duration:.25},t+D-.85);
}

pop('#project .project-home',at('project',.25));tl.fromTo('#project .project-item',{opacity:0,x:90},{opacity:1,x:0,duration:.45,stagger:.75,ease:'power3.out'},at('project',1));
tl.fromTo('.progress>div',{scaleX:0},{scaleX:1,duration:scenes.at(-1).start+scenes.at(-1).duration,ease:'none'},0);document.querySelectorAll('.voice-caption').forEach(e=>{tl.set(e,{opacity:1},Number(e.dataset.from));tl.set(e,{opacity:0},Number(e.dataset.to));});window.__timelines={main:tl};