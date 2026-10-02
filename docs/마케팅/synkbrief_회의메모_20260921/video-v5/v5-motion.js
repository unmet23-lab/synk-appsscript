for(const s of scenes){
  const el=document.querySelector('#'+s.id+' .inner');
  if(s.id!=='ending'){const strip=document.createElement('div');strip.className='chapter-strip';el.appendChild(strip);tl.fromTo(strip,{scaleX:0},{scaleX:1,duration:.55,ease:'power3.out'},s.start+.12);}
}
tl.fromTo('#hook .hook-result .tr:not(.th)',{opacity:0,x:65},{opacity:1,x:0,duration:.42,stagger:.2,ease:'back.out(1.1)'},1.5);
tl.fromTo('#result .result-explain .tr:not(.th)',{opacity:0,x:65},{opacity:1,x:0,duration:.42,stagger:.25,ease:'power3.out'},44.6);
tl.fromTo('#work .work-flow>div',{opacity:0,scale:.84,y:25},{opacity:1,scale:1,y:0,duration:.4,stagger:.18,ease:'back.out(1.3)'},76);
tl.fromTo('#skill .recipe',{opacity:0,rotation:-3,scale:.92},{opacity:1,rotation:0,scale:1,duration:.5,ease:'power3.out'},82.3);
tl.fromTo('#skill .recipe-rule',{opacity:0,x:80},{opacity:1,x:0,duration:.4,stagger:1.2,ease:'power3.out'},83.2);
tl.fromTo('#skill .repeat-row',{opacity:0,y:35},{opacity:1,y:0,duration:.4,ease:'power3.out'},86.8);
tl.fromTo('#work-open .setup-step',{opacity:0,x:-55},{opacity:1,x:0,duration:.4,stagger:.6,ease:'power3.out'},89.4);
tl.fromTo('#work-open .mention',{opacity:0,scale:.86,y:35},{opacity:1,scale:1,y:0,duration:.5,ease:'back.out(1.2)'},91);
tl.fromTo('#create-skill .setup-request',{opacity:0,y:50,rotation:1},{opacity:1,y:0,rotation:0,duration:.5,ease:'power3.out'},96.3);
tl.fromTo('#create-skill .setup-request p',{opacity:0,x:30},{opacity:1,x:0,duration:.35,stagger:.2,ease:'power3.out'},97);
tl.fromTo('#enable-skill .save-item',{opacity:0,x:65},{opacity:1,x:0,duration:.45,stagger:.3,ease:'power3.out'},105.4);
tl.fromTo('#enable-skill .note',{opacity:0,scale:.95},{opacity:1,scale:1,duration:.45,ease:'back.out(1.1)'},108);
tl.fromTo('#reuse .reuse-input',{opacity:0,y:45},{opacity:1,y:0,duration:.4,ease:'power3.out'},112.3);
tl.fromTo('#reuse .reuse-result',{opacity:0,y:40},{opacity:1,y:0,duration:.5,ease:'power3.out'},116.2);
tl.fromTo('#reuse .reuse-result>div',{opacity:0,x:40},{opacity:1,x:0,duration:.4,stagger:.2,ease:'power3.out'},116.5);
tl.fromTo('#ending .pdf-fan img',{opacity:0,x:70,y:25,rotation:3},{opacity:1,x:0,y:0,rotation:0,duration:.6,stagger:.13,ease:'power3.out'},120.4);
tl.fromTo('#ending .end-description',{opacity:0,y:25},{opacity:1,y:0,duration:.4,ease:'power3.out'},121.2);
tl.fromTo('#ending .end-cta',{opacity:0,scale:.93},{opacity:1,scale:1,duration:.5,ease:'back.out(1.2)'},122.8);
// Adapt the installed press-ripple component's two-ring release envelope to actual screenshot buttons.
for(const [id,x,y,t] of [['send',815,1176,41.1],['copy',843,1037,72.1]]){
  const host=document.querySelector('#'+id+' .inner');
  for(let i=0;i<2;i++){
    const ring=document.createElement('div');
    ring.style.cssText='position:absolute;left:'+(x-38)+'px;top:'+(y-38)+'px;width:76px;height:76px;border:5px solid #3D6BC9;border-radius:50%;opacity:0;z-index:3;pointer-events:none';
    host.appendChild(ring);
    tl.fromTo(ring,{scale:.16,opacity:.95},{scale:2.6,opacity:0,duration:.66,ease:'power2.out',immediateRender:false},t+.1+i*.11);
  }
}
tl.fromTo('#missing mark',{backgroundColor:'#ffedaa'},{backgroundColor:'#ffd65f',duration:.32,yoyo:true,repeat:1,ease:'power2.out'},34.2);
tl.fromTo('#result .result-explain .tr:nth-child(2)',{backgroundColor:'#f4f7fc'},{backgroundColor:'#dce7fa',duration:.35,yoyo:true,repeat:1},46);
