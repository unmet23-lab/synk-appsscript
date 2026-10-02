'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const base=__dirname,root=path.join(base,'mongle-video'),assets=path.join(root,'assets');
const run=(exe,args)=>{const r=cp.spawnSync(exe,args,{encoding:'utf8',windowsHide:true,maxBuffer:8e6});if(r.status)throw Error(r.stderr||r.stdout);return r.stdout;};
const write=(p,s)=>fs.writeFileSync(path.join(root,p),s);
const speech=JSON.parse(fs.readFileSync(path.join(base,'audio/speech.json'),'utf8'));
const voice={};
for(const s of speech){
  const a=Math.max(0,s.words[0].start-.055),b=Math.min(s.duration,s.words.at(-1).end+.14);
  const file=path.join(assets,s.id+'.wav');
  run('ffmpeg',['-y','-v','error','-i',s.path,'-af',`atrim=start=${a}:end=${b},asetpts=PTS-STARTPTS,aresample=48000`,'-ac','2',file]);
  voice[s.id]={...s,duration:+(b-a).toFixed(4),words:s.words.map(w=>({...w,start:w.start-a,end:w.end-a}))};
}
for(const name of ['base','blink','smile','shy','curious','relief','right','lab-logo']){
  if(!fs.existsSync(path.join(assets,name+'.webp')))run('ffmpeg',['-y','-v','error','-i',path.join(assets,name+'.png'),'-vf','scale=1200:-1','-frames:v','1','-c:v','libwebp','-quality','94',path.join(assets,name+'.webp')]);
}
const sfxRoot='C:/Users/q1212/.agents/skills/media-use/audio/assets/sfx';
for(const n of ['whoosh-short','pop','click-soft'])fs.copyFileSync(path.join(sfxRoot,n+'.mp3'),path.join(assets,n+'.mp3'));
const scenes=[],clips=[],captions=[];
let pos=0;
function scene(id,type,heading,build){
  const s={id,type,heading,start:pos,cues:[],duration:0};let t=.18;
  const say=(id,gap=.17)=>{const v=voice[id],c={id,at:t,duration:v.duration,text:v.text,role:v.role,words:v.words};s.cues.push(c);t+=v.duration+gap;return c.at;};
  const wait=n=>{t+=n;}; const mark=()=>t;
  build(s,{say,wait,mark});s.duration=Math.ceil((t+.16)*30)/30;
  scenes.push(s);
  for(const c of s.cues){clips.push({...c,start:pos+c.at,scene:s.id});captions.push({start:pos+c.at,end:pos+c.at+c.duration,text:c.text,role:c.role});}
  pos+=s.duration;
}
scene('hook','hook','못 들었는데\n“네”부터 나왔다',(s,{say,wait})=>{say('question');s.nod=say('yes',.22);s.thought=say('thought');wait(.05);});
scene('learn','learn','이럴 땐, 이 한마디',(s,{say,wait})=>{say('guide',.12);s.phrase=say('phrase',.2);say('repeat',.08);wait(2.5);});
scene('retry','retry','아까 그 순간으로',(s,{say,wait})=>{wait(.55);say('question');s.phrase=say('phrase',.3);});
scene('understood','understood','이번엔 알아들었어요',(s,{say})=>{say('easy-question');s.answer=say('eat',.2);});
scene('practice','practice','어? 또 질문이 왔어요',(s,{say,wait,mark})=>{say('receipt',.22);say('your-turn',.2);s.practice=mark();wait(5);});
scene('ending','ending','다시 말해 주세요.',(s,{say,wait})=>{s.phrase=say('phrase',.28);say('easy-receipt',.18);s.thanks=say('thanks',.2);wait(.5);});
const dur=+pos.toFixed(4);
run('ffmpeg',['-y','-v','error','-f','lavfi','-i',`anoisesrc=color=brown:amplitude=0.009:duration=${dur}:seed=41`,'-af','highpass=f=180,lowpass=f=1400','-ar','48000','-ac','2',path.join(assets,'room-tone.wav')]);
write('timing.json',JSON.stringify({duration:dur,scenes,clips,captions},null,2));
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const cameraHelpers=`function cameraMove(tl,target,at,o={}){tl.to(target,{scale:1+(o.zoom??.11),x:o.x??0,y:o.y??0,duration:o.dur??.8,ease:'power2.inOut'},at);}`;
const sharedCSS=`@font-face{font-family:SUIT;src:url('assets/SUIT-Variable.woff2') format('woff2');font-weight:100 900}*{box-sizing:border-box} .stage{position:absolute;inset:0;overflow:hidden;background:#fff;font-family:SUIT,sans-serif;color:#000}.camera{position:absolute;inset:0;transform-origin:38% 64%}.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.ground{position:absolute;left:82px;top:1330px;width:648px;height:86px;border-radius:50%;background:radial-gradient(ellipse,rgba(61,39,27,.21),rgba(61,39,27,.08) 47%,transparent 70%)}.actor{position:absolute;left:-42px;top:598px;width:955px;height:955px;transform-origin:48% 83%}.face{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}.logo{position:absolute;left:70px;top:73px;width:268px;height:auto}.head{position:absolute;left:75px;top:218px;width:835px;white-space:pre-line;font-size:80px;font-weight:850;line-height:1.12;letter-spacing:-3px}.smallhead{font-size:60px;line-height:1.2}.dialogue{position:absolute;left:72px;right:100px;top:1450px;min-height:158px;border-radius:34px;background:#fff;box-shadow:0 8px 24px #0000000d;padding:26px 34px;display:flex;flex-direction:column;justify-content:center}.who{font-size:26px;font-weight:650;line-height:1.3;color:#525252;margin-bottom:10px}.line{font-size:49px;line-height:1.32;font-weight:700;letter-spacing:-1.6px;word-break:keep-all}.phrase{position:absolute;left:74px;top:415px;right:95px;font-size:94px;line-height:1.14;font-weight:850;letter-spacing:-3px}.phrase .coral{color:#ba3d31;display:block}.phrase .rest{display:block}.bubble{position:absolute;top:605px;left:600px;font-size:72px;font-weight:850;background:#fff;border-radius:42px;padding:25px 38px;box-shadow:0 8px 25px #00000012}.practice-copy{position:absolute;left:76px;right:102px;top:427px;font-size:51px;font-weight:750;line-height:1.4;letter-spacing:-1.5px;word-break:keep-all}.lowernote{position:absolute;left:76px;top:1655px;font-size:30px;line-height:1.4;font-weight:600;color:#3a3a3a}.brand-close{position:absolute;right:104px;top:1656px;width:235px}.endphrase{font-size:82px}.rewind-label{position:absolute;left:75px;top:434px;display:flex;align-items:center;gap:18px;font-size:40px;font-weight:750}.rewind-icon{display:flex;gap:4px}.tri{width:0;height:0;border-top:17px solid transparent;border-bottom:17px solid transparent;border-right:25px solid #ba3d31}`;
const labels={barista:'카페 직원',mongle:'몽글',guide:'함께 말해 봐요'};
fs.mkdirSync(path.join(root,'compositions/scenes'),{recursive:true});
for(const s of scenes){
  const p=s.id;
  let extra='',anim=`tl.fromTo('#${p}-logo',{opacity:0},{opacity:1,duration:.3},0);\ntl.fromTo('#${p}-head',{y:18,opacity:0},{y:0,opacity:1,duration:.4,ease:'power3.out'},0);\n`;
  const basePose=s.type==='understood'?'smile':s.type==='practice'?'curious':s.type==='ending'?'relief':'base';
  let faces=`<img id="${p}-pose" class="face" src="assets/${basePose}.webp" alt="몽글">`;
  const expressions=new Set();
  function expression(file,at,end){let key=p+'-emotion-'+file;if(!expressions.has(file)){faces+=`<img id="${key}" class="face" src="assets/${file}.webp" alt="" style="opacity:0">`;expressions.add(file);}anim+=`tl.set('#${key}',{opacity:1},${at});tl.set('#${key}',{opacity:0},${end});\n`;}
  for(let t=1.5;t<s.duration-1;t+=3.9)expression('blink',t,t+.12);
  anim+=`tl.fromTo('#${p}-actor',{y:0,scaleY:1},{y:-4,scaleY:1.006,duration:1.6,repeat:${Math.max(0,Math.floor(s.duration/1.6)-1)},yoyo:true,ease:'sine.inOut'},0);\n`;
  if(s.type==='hook'){
    anim+=`tl.to('#${p}-acting',{rotation:5,y:13,duration:.18,ease:'power2.in'},${s.nod});tl.to('#${p}-acting',{rotation:0,y:0,duration:.25,ease:'power2.out'},${s.nod+.19});\n`;
    expression('shy',s.thought,s.duration-.01);
    extra+=`<div id="${p}-question" class="bubble" style="opacity:0">…?</div>`;
    anim+=`tl.fromTo('#${p}-question',{scale:.3,opacity:0},{scale:1,opacity:1,duration:.24,ease:'power3.out'},${s.thought+.1});cameraMove(tl,'#${p}-camera',${s.thought},{zoom:.13,dur:.38,y:-25});\n`;
  }
  if(['learn','retry','ending'].includes(s.type)){
    extra+=`<div id="${p}-phrase" class="phrase" style="opacity:0"><span class="coral">다시</span><span class="rest">말해 주세요.</span></div>`;
    anim+=`tl.fromTo('#${p}-phrase',{opacity:0,y:18},{opacity:1,y:0,duration:.28,ease:'power3.out'},${s.phrase});\n`;
    expression('smile',s.phrase+.5,s.duration-.01);
  }
  if(s.type==='retry'){
    extra+=`<div id="${p}-rewind" class="rewind-label"><span class="rewind-icon"><i class="tri"></i><i class="tri"></i></span><span>다시 해볼까요?</span></div>`;
    anim+=`tl.fromTo('#${p}-acting',{rotation:4,x:48},{rotation:0,x:0,duration:.55,ease:'power2.out'},0);tl.set('#${p}-rewind',{opacity:0},.68);\n`;
  }
  if(s.type==='understood'){anim+=`tl.to('#${p}-acting',{rotation:-4,duration:.32,ease:'power2.out'},${s.answer});tl.to('#${p}-acting',{rotation:0,duration:.42,ease:'power2.out'},${s.answer+.5});\n`;}
  if(s.type==='practice'){
    extra+=`<div id="${p}-practice" class="practice-copy" style="opacity:0">잘 못 들었어요.<p style="margin-top:12px">다시 부탁해 볼까요?</p></div>`;
    anim+=`tl.fromTo('#${p}-practice',{opacity:0,y:14},{opacity:1,y:0,duration:.3,ease:'power3.out'},${s.practice});\n`;
    expression('base',s.practice,s.duration-.01);
  }
  if(s.type==='ending'){
    extra+=`<div class="lowernote">못 들었을 때, 다시 부탁해요.</div>`;
    anim+=`tl.to('#${p}-acting',{rotation:-5,duration:.25},${s.thanks});tl.to('#${p}-acting',{rotation:3,duration:.35},${s.thanks+.35});tl.to('#${p}-acting',{rotation:0,duration:.4},${s.thanks+.8});\n`;
  }
  // Timed captions use hard visibility boundaries through framework-owned clips.
  let captionHTML=s.cues.map((c,i)=>`<div id="${p}-caption-${i}" class="clip" data-start="${c.at}" data-duration="${c.duration}" data-track-index="4"><div class="dialogue"><div class="who">${labels[c.role]}</div><div class="line">${esc(c.text)}</div></div></div>`).join('\n');
  let html=`<!doctype html><html lang="ko"><head><meta charset="utf-8"></head><body><template><style>${sharedCSS}\n#root{position:absolute;inset:0;width:100%;height:100%;overflow:hidden}.clip{position:absolute;inset:0}</style><div id="root" data-composition-id="${p}" data-width="1080" data-height="1920" data-duration="${s.duration}"><div class="stage"><div id="${p}-camera" class="camera"><img class="bg" src="assets/cafe.png" alt="밝은 카페"><div class="ground"></div><div id="${p}-actor" class="actor"><div id="${p}-acting" style="position:absolute;inset:0;transform-origin:48% 80%">${faces}</div></div></div><img id="${p}-logo" class="logo" src="assets/lab-logo.webp" alt="SYNK LAB"><div id="${p}-head" class="head ${s.type==='hook'?'':'smallhead'}">${esc(s.heading)}</div>${extra}${captionHTML}</div></div><script>{const tl=gsap.timeline({paused:true});${cameraHelpers}\n${anim}\nwindow.__timelines['${p}']=tl;}</script></template></body></html>`;
  write('compositions/scenes/'+p+'.html',html);
}
const sceneHTML=scenes.map(s=>`<div id="${s.id}" class="clip" data-composition-id="${s.id}" data-composition-src="compositions/scenes/${s.id}.html" data-start="${s.start}" data-duration="${s.duration}" data-track-index="0" data-width="1080" data-height="1920"></div>`).join('\n');
const audioHTML=clips.map((c,i)=>`<audio id="voice-${i}" src="assets/${c.id}.wav" data-start="${c.start}" data-duration="${c.duration}" data-track-index="8" data-volume="1"></audio>`).join('\n');
let sfxHTML=`<audio id="room-tone" src="assets/room-tone.wav" data-start="0" data-duration="${dur}" data-track-index="10" data-volume="1"></audio>`;
for(const [i,at,name,gain]of [[0,scenes[0].nod,'pop',.2],[1,scenes[2].start,'whoosh-short',.18]])sfxHTML+=`<audio id="effect-${i}" src="assets/${name}.mp3" data-start="${at}" data-duration=".55" data-track-index="9" data-volume="${gain}"></audio>`;
write('index.html',`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=1080,height=1920"><script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script><style>@font-face{font-family:SUIT;src:url('assets/SUIT-Variable.woff2')}*{margin:0;box-sizing:border-box}html,body{width:1080px;height:1920px;overflow:hidden;background:#fff}#root{width:100%;height:100%;position:relative;font-family:SUIT,sans-serif}.clip{position:absolute;inset:0}</style></head><body><div id="root" data-composition-id="main" data-width="1080" data-height="1920" data-duration="${dur}">${sceneHTML}${audioHTML}${sfxHTML}</div><script>const tl=gsap.timeline({paused:true});window.__timelines['main']=tl;</script></body></html>`);
const fmt=t=>new Date(Math.round(t*1000)).toISOString().slice(11,23).replace('.',',');
write('captions.ko.srt',captions.map((c,i)=>`${i+1}\n${fmt(c.start)} --> ${fmt(c.end)}\n${c.text}\n`).join('\n'));
write('STORYBOARD.md',`# Cafe Korean · Mongle\n\nAutonomous; user requested completed video without intermediate review.\n\n`+scenes.map((s,i)=>`## Frame ${i+1}\nstatus: animated\nsrc: compositions/scenes/${s.id}.html\nstart: ${s.start}\nduration: ${s.duration}\nshape: spring-pop-entrance for lesson text; approved pose substitutions and finite GSAP reaction keyframes; yt-camera-move helper for the hook camera.\nbeat: ${s.heading.replace('\n',' ')}\n`).join('\n'));
write('frame.md','# SYNK LAB video design\n\nAuthority: repository DESIGN.md and brand asset sources. White canvas, black text, original coral mascot, approved unstitched synk + stitched LAB logo. SUIT Variable for Korean. Bright photoreal cafe environment with canonical felt character. Leave faces visible, place readable dialogue in a stable lower zone. Meaningful actor reaction and brief camera movement; avoid decorative particles and scoring UI. Final viewer practice hides every answer and hint for five seconds.\n');
write('assets/provenance.json',JSON.stringify({cafe:{provider:'built-in image_gen',source:'exec-fc14c552-8e51-4d49-a583-4b382af13f65.png',purpose:'empty vertical environment plate'},mascot:{source:'tools/lib/마스코트자산.js canonical 4K set',processing:'1200px WebP delivery derivatives; source preserved'},logo:{source:'docs/홍보물/마케팅실행_20260909/브랜드킷/배치용/SYNK-LAB-Ink.png',processing:'WebP delivery derivative'},voice:{provider:'Microsoft Edge TTS',lines:speech.map(s=>({id:s.id,text:s.text,settings:s.settings})),processing:'leading/trailing silence trimmed using provider word boundaries'},sfx:{source:sfxRoot,files:['pop.mp3','whoosh-short.mp3']},ambience:{source:'locally synthesized low-level room tone; no recorded cafe claims'},camera:{source:'HyperFrames registry yt-camera-move',use:'cameraMove helper adapted without defocus overlay'}},null,2));
console.log(JSON.stringify({duration:dur,scenes:scenes.map(s=>({id:s.id,start:s.start,duration:s.duration})),captions:captions.length}));
