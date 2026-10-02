import fs from 'node:fs';
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const voice=JSON.parse(fs.readFileSync('voice-timing.json','utf8'));
const scenes=JSON.parse(fs.readFileSync('content.json','utf8'));
const chapters=new Set(['common','open','result','project-menu','repeat-menu','ending']);
let time=0;for(const s of scenes){s.start=time;s.transition=chapters.has(s.id)?'chapter':'continuation';time+=s.duration;}
const cues=[];
const cue=(at,type,gain,reason)=>cues.push({at:Number(at.toFixed(3)),type,gain,reason});
const sfx={click:['click-soft.wav',.4],swish:['swish-soft.wav',.6],pop:['pop-soft.wav',.7],chime:['sfx_003.mp3',2.5]};
for(const s of scenes){
 if(s.start&&chapters.has(s.id))cue(s.start-.08,'swish',.16,'chapter '+s.id);
 if(s.camera){
  const c=s.camera;cue(s.start+(c.actionAt||2.2),'click',.25,'click '+s.id);
  if(c.nextFocus)cue(s.start+(c.nextAt||4),'click',.25,'next control '+s.id);
  if(c.confirmPoint)cue(s.start+(c.confirmAt||4.65),'click',.25,'confirm '+s.id);
 }
}
for(const [id,offset,gain] of [['common',2.1,.12],['result',2.7,.15],['result',3.78,.12],['project-reuse',2,.13],['project-reuse',2.35,.12],['ending',1.2,.1]]){
 cue(scenes.find(s=>s.id===id).start+offset,'pop',gain,id+' semantic reveal');
}
cue(scenes.find(s=>s.id==='ending').start+4.88,'chime',.085,'follow and comment invitation');
const sceneHtml=scenes.map((s,i)=>{
 const overlap=i<scenes.length-1?(scenes[i+1].transition==='chapter'?.43:.27):0;
 return `<section id="${s.id}" class="clip ${s.theme||''}" data-start="${s.start}" data-duration="${s.duration+overlap}" data-track-index="1"><div class="scene-surface"><div class="inner"><header class="masthead"><div class="brand">synkbrief</div><div class="step">${s.step}</div></header><div class="chapter-line"></div><h1>${s.title.split('<br>').map(t=>`<span><em>${t}</em></span>`).join('')}</h1><div class="scene-content ${s.camera?'camera-content':''}">${s.body}</div><div class="caption">${voice.captions.filter(c=>c.start>=s.start&&c.start<s.start+s.duration).map(c=>`<span class="voice-caption" data-from="${c.start}" data-to="${c.end}">${esc(c.text)}</span>`).join('')}</div><div class="footer"><span>가상 메모 실습 · 2026.09.23 화면</span><span>${String(i+1).padStart(2,'0')} / ${scenes.length}</span></div></div></div></section>`;
}).join('');
const audio=cues.map((a,i)=>`<audio id="finish-sfx-${i}" src=".media/audio/sfx/${sfx[a.type][0]}" data-start="${a.at}" data-duration="${sfx[a.type][1]}" data-track-index="${a.type==='click'?13:14}" data-volume="${a.gain}" data-audio-group="sfx"></audio>`).join('');
const html=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>synkbrief · 회의 정리 v19</title><script src="vendor/gsap.min.js"></script><style>${fs.readFileSync('layout.css','utf8')}</style></head><body><main id="root" data-composition-id="main" data-width="1080" data-height="1920" data-duration="${time}">${sceneHtml}${fs.readFileSync('approved-audio.html','utf8')}${audio}<div class="progress"><div></div></div></main><script>const scenes=${JSON.stringify(scenes.map(({id,start,duration,camera,transition})=>({id,start,duration,camera,transition})))};document.fonts.ready.then(()=>{${fs.readFileSync('motion.js','utf8')}});</script></body></html>`;
fs.writeFileSync('index.html',html);fs.writeFileSync('scenes.json',JSON.stringify(scenes,null,2));fs.writeFileSync('sound-cues.json',JSON.stringify(cues,null,2));
console.log({duration:time,scenes:scenes.length,transitions:scenes.length-1,chapterSlides:chapters.size,soundCues:cues.length});
