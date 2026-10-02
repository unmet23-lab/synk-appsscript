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
pop('#project .folder',at('project',.3));tl.fromTo('#project .rule-file',{opacity:0,rotationX:35,y:-120},{opacity:1,rotationX:0,y:0,duration:.65,ease:'back.out(1.2)'},at('project',.65));tl.fromTo('#project .links path',{strokeDasharray:1300,strokeDashoffset:1300},{strokeDashoffset:0,duration:1.2,ease:'power2.inOut'},at('project',1.4));tl.fromTo('#project .chat-card',{opacity:0,y:80,scale:.8},{opacity:1,y:0,scale:1,duration:.45,stagger:.35,ease:'back.out(1.2)'},at('project',2));
tl.fromTo('#global .branch-row>div',{opacity:0,y:-65},{opacity:1,y:0,duration:.4,stagger:.25},at('global',.65));tl.to('#global .irrelevant',{x:9,duration:.075,yoyo:true,repeat:3},at('global',2.1));tl.fromTo('#right-scope',{clipPath:'inset(0 100% 0 0)'},{clipPath:'inset(0 0% 0 0)',duration:.55,ease:'power3.out'},at('global',3.5));
pop('#create-over',at('create',.2));click('#create-cursor','create');tl.fromTo('#create-dialog',{opacity:0,scale:.91,y:85},{opacity:1,scale:1,y:0,duration:.55,ease:'back.out(1.1)'},at('create',2));
pop('#settings-shot',at('settings',.2));click('#settings-cursor','settings');zoom('#settings-shot','settings',2.2,[830,138,240]);tl.to('#settings-cursor',{opacity:0,duration:.15},at('settings',2.15));
pop('#save .file-pill',at('save',.25));pop('#save-shot',at('save',.65));pop('#save-button',at('save',1.1));tl.fromTo('#save .paste-chip',{opacity:0,x:-75,scale:.8},{opacity:1,x:0,scale:1,duration:.45,ease:'back.out(1.2)'},at('save',1.9));click('#save-cursor','save',4.3);tl.to('#save .file-pill',{y:120,opacity:0,scale:.88,duration:.45},at('save',2.05));
tl.fromTo('#rules mark',{opacity:0,scale:.5},{opacity:1,scale:1,duration:.4,ease:'back.out(1.8)'},at('rules',1.7));tl.fromTo('#rules .reason-note',{opacity:0,clipPath:'inset(0 100% 0 0)'},{opacity:1,clipPath:'inset(0 0% 0 0)',duration:.65,ease:'power3.out'},at('rules',2.3));
tl.fromTo('#repeat .repeat-path>b',{opacity:0,x:-100},{opacity:1,x:0,duration:.45,stagger:.4,ease:'back.out(1.1)'},at('repeat',.3));pop('#repeat-shot',at('repeat',1.2));
tl.fromTo('#ending .pdf-fan img',{opacity:0,y:140,rotationY:-30,rotation:5},{opacity:1,y:0,rotationY:0,rotation:0,duration:.7,stagger:.2,ease:'power3.out'},at('ending',.35));tl.fromTo('#ending .kit-tags b',{opacity:0,y:35},{opacity:1,y:0,duration:.35,stagger:.2},at('ending',1.2));tl.fromTo('#ending .solid',{scale:.8},{scale:1,duration:.5,ease:'back.out(1.3)'},at('ending',2.2));

pop('#hook .felt',.2,.6);
tl.fromTo('#record .wave i',{scaleY:.25},{scaleY:1,duration:.35,stagger:.055,yoyo:true,repeat:8,ease:'sine.inOut'},at('record',.4));
pop('#record .audio-note',at('record',.2));
tl.fromTo('#common .routes b',{opacity:0,y:-60},{opacity:1,y:0,duration:.4,stagger:.4},at('common',.2));pop('#common .merge-arrow',at('common',1.5));
pop('#prepare .notepad',at('prepare',.3));tl.fromTo('#prepare .notepad p',{backgroundColor:'#ffffff'},{backgroundColor:'#d4e4ff',duration:.5,stagger:.4},at('prepare',1.3));
pop('#open-shot',at('open',.3));pop('#paste .request-box',at('paste',1));
tl.fromTo('#paste .request-box p',{opacity:0,x:40},{opacity:1,x:0,duration:.4,stagger:.5},at('paste',1.6));
pop('#send-shot',at('send',.2));click('#send-cursor','send');

pop('#open .input-outline',at('open',.7));click('#input-cursor','open',2.5);pop('#open .input-callout',at('open',1.2));
tl.fromTo('#open .input-arrow path',{strokeDasharray:500,strokeDashoffset:500},{strokeDashoffset:0,duration:.6,stagger:.1},at('open',.85));
pop('#request .instruction-part',at('request',.3));pop('#request .note-part',at('request',1.3));pop('#send .send-outline',at('send',.9));
pop('#result .before-notes',at('result',.25));pop('#result .compare-command',at('result',2));pop('#result .after-label',at('result',2.75));
tl.fromTo('#result .after-notes>div',{opacity:0,x:65},{opacity:1,x:0,duration:.45,stagger:.5,ease:'power3.out'},at('result',3));
tl.fromTo('#result .before-notes .match-blue,#result .before-notes .match-amber',{backgroundColor:'#ffffff'},{backgroundColor:(i)=>i===0?'#dceaff':'#ffedbc',duration:.5,stagger:1},at('result',3.5));
pop('#save .instruction-outline',at('save',1.3));
tl.fromTo('.progress>div',{scaleX:0},{scaleX:1,duration:scenes.at(-1).start+scenes.at(-1).duration,ease:'none'},0);window.__timelines={main:tl};