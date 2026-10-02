const fs=require('node:fs');const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const data=JSON.parse(fs.readFileSync('voice-timing.json'));const b=await chromium.launch({channel:'chrome',headless:true});const p=await b.newPage({viewport:{width:1080,height:1920}});const errors=[],issues=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:5197/video-v14/index.html');await p.evaluate(()=>document.fonts.ready);
for(const [i,c]of data.captions.entries()){
 const scene=data.clips.find(s=>c.start>=s.start&&c.end<=s.start+s.duration+.01);if(!scene){issues.push({i,type:'outside scene'});continue;}
 const result=await p.evaluate(({id,t})=>{document.querySelectorAll('.clip').forEach(e=>e.style.display=e.id===id?'block':'none');window.__timelines.main.seek(t);return [...document.querySelectorAll('#'+id+' .voice-caption')].filter(e=>Number(getComputedStyle(e).opacity)>.5).map(e=>{const r=e.getBoundingClientRect();return{text:e.textContent,right:r.right,bottom:r.bottom,left:r.left};});},{id:scene.id,t:(c.start+c.end)/2});
 if(result.length!==1||result[0]?.text!==c.text||result.some(r=>r.right>1010||r.bottom>1730||r.left<60))issues.push({i,result});
 if([0,3,25,32,46].includes(i))await p.screenshot({path:`verification/voice-caption-${i}.png`});
}
for(const clip of data.clips)if(clip.voiceStart+clip.voiceDuration>clip.start+clip.duration-.1)issues.push({id:clip.id,type:'voice cut off'});
await b.close();const result={captions:data.captions.length,clips:data.clips.length,duration:data.duration,errors,issues};fs.writeFileSync('verification/voice-qa.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(errors.length||issues.length)process.exitCode=1;})();
