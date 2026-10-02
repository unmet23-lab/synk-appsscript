import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

// Preserve the approved speech, music and all 23 instructional steps.
const original=fs.readFileSync('../video-v18/index.html','utf8');
fs.writeFileSync('approved-audio.html',[...original.matchAll(/<audio\b[^>]*id="(?:narration|music|music-tail)"[^>]*><\/audio>/g)].map(m=>m[0]).join('\n'));
let motion=fs.readFileSync('../video-v18/motion.js','utf8')
 .replace(" tl.set(q+' .wipe',{scaleX:0},0);\r\n tl.to(q+' .wipe',{scaleX:1,duration:.16,ease:'power2.in'},s.start+s.duration-.16);",'')
 .replace(" tl.set(q+' .wipe',{scaleX:0},0);\n tl.to(q+' .wipe',{scaleX:1,duration:.16,ease:'power2.in'},s.start+s.duration-.16);",'');
// Titles stay readable; the camera remains anchored to the real interface.
motion=motion.replace("pop('#result .compare-command',at('result',2));","pop('#result .compare-command',at('result',1.8));");
const finish=`
// Page-slide primitive, adapted to scene-sized inner surfaces. The timed
// outer clips overlap only for the handoff; the runtime owns their visibility.
for(let i=1;i<scenes.length;i++){
 const prev=scenes[i-1],s=scenes[i],old='#'+prev.id+' .scene-surface',fresh='#'+s.id+' .scene-surface';
 if(s.transition==='chapter'){
  tl.to(old,{xPercent:-24,scale:.975,duration:.42,ease:'power3.inOut'},s.start);
  tl.fromTo(fresh,{xPercent:100},{xPercent:0,duration:.42,ease:'power3.inOut'},s.start);
 }else{
  tl.to(old,{y:-12,scale:.998,duration:.26,ease:'power2.inOut'},s.start);
  tl.fromTo(fresh,{y:22,opacity:0},{y:0,opacity:1,duration:.26,ease:'power2.out'},s.start);
 }
}
// Each category arrives as the narrator explains how scattered notes change.
tl.fromTo('#result .after-label',{opacity:0,y:12},{opacity:1,y:0,duration:.25},at('result',2.45));
tl.fromTo('#result .after-notes>div',{opacity:0,y:24},{opacity:1,y:0,duration:.32,stagger:.36,ease:'power3.out'},at('result',2.7));
tl.fromTo('#common .result-sections>span',{opacity:0,y:16},{opacity:1,y:0,duration:.3,stagger:.15,ease:'power3.out'},at('common',2.1));
tl.fromTo('#project-reuse .folder-bottom',{opacity:0,y:12},{opacity:1,y:0,duration:.35},at('project-reuse',4.15));
// A brief visual confirmation belongs to the explained result, not a loop.
tl.fromTo('#rules .row-card',{opacity:.5},{opacity:1,duration:.28},at('rules',1.25));
tl.fromTo('#ending .cta-underline',{scaleX:0},{scaleX:1,duration:.45,ease:'power3.out'},at('ending',6.2));
tl.to('#ending .solid',{scale:1.025,duration:.2,yoyo:true,repeat:1,ease:'sine.inOut'},at('ending',4.88));
`;
motion=motion.replace('window.__timelines={main:tl};',finish+'\nwindow.__timelines={main:tl};');
fs.writeFileSync('motion.js',motion);
const css=fs.readFileSync('../video-v18/layout.css','utf8')+`
/* v19: solid scene surfaces eliminate the repeated pale full-frame flash. */
.scene-surface{position:absolute;inset:0;transform-origin:50% 50%;overflow:hidden;background:#fff}
.blue .scene-surface{background:#244fa9}
#ending .solid strong{position:relative;display:inline-block}
.cta-underline{display:block;position:absolute;left:0;right:0;bottom:-5px;height:5px;border-radius:5px;background:#4777ce;transform-origin:left}
`;
fs.writeFileSync('layout.css',css);
const scenes=JSON.parse(fs.readFileSync('content.json','utf8'));
scenes.find(s=>s.id==='ending').body=scenes.find(s=>s.id==='ending').body.replace('<strong>synk</strong>','<strong>synk<i class="cta-underline"></i></strong>');
fs.writeFileSync('content.json',JSON.stringify(scenes,null,2));
const voice=JSON.parse(fs.readFileSync('voice-timing.json','utf8'));
let repaired=0;
for(let i=0;i<voice.captions.length-1;i++)if(voice.captions[i].end>voice.captions[i+1].start){voice.captions[i].end=voice.captions[i+1].start-.01;repaired++;}
fs.writeFileSync('voice-timing.json',JSON.stringify(voice,null,2));
const stamp=t=>new Date(t*1000).toISOString().slice(11,23).replace('.',',');
const srt=voice.captions.map((c,i)=>String(i+1)+'\n'+stamp(c.start)+' --> '+stamp(c.end)+'\n'+c.text).join('\n\n')+'\n';
fs.writeFileSync('narration.srt',srt);fs.writeFileSync('captions.srt',srt);
// Soften sharp high frequencies in the existing licensed bundled effects.
for(const [input,output,filter] of [
 ['sfx_001.mp3','click-soft.wav','highpass=f=180,lowpass=f=5500,afade=t=out:st=0.25:d=0.15'],
 ['sfx_002.mp3','swish-soft.wav','highpass=f=420,lowpass=f=4200,afade=t=in:d=0.025,afade=t=out:st=0.32:d=0.28'],
 ['sfx_004.mp3','pop-soft.wav','highpass=f=200,lowpass=f=4500,afade=t=out:st=0.35:d=0.35']
])execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i','.media/audio/sfx/'+input,'-af',filter,'-ar','48000','-ac','2','.media/audio/sfx/'+output]);
console.log({captionOverlapsRepaired:repaired});
