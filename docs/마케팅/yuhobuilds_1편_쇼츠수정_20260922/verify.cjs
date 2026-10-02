'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const script=require('./narration-script.json'),captions=require('./captions.json'),timing=require('./장면타이밍.json');
const normalize=s=>s.replaceAll('백 시간','100시간').replaceAll('일인 기업가','1인 기업가').replaceAll('유월','6월').replaceAll('이일','2일').replace(/[\s.,!?]/g,'');
if(normalize(script.segments.map(s=>s.text).join(''))!==normalize(captions.map(c=>c.text).join('')))throw Error('Caption text mismatch');
if(captions.some((c,i)=>c.endMs<=c.startMs||c.endMs>timing.durationInFrames/30*1000||(i&&c.startMs<captions[i-1].endMs)))throw Error('Caption timing mismatch');
const promptScene=timing.scenes.find(s=>s.visual==='prompt'),keys=promptScene.typing.keys;
const promptWords=require('./words.json').filter(w=>w.segment===promptScene.id);
const phraseEnd=promptWords.find(w=>w.text==='싶어.').end;
const typingEnd=(promptScene.start+promptScene.typing.endFrame)/30;
const keyboard=require('./검수/타이핑동기화.json');
if(keys.at(-1).count!==promptScene.typing.text.length||Math.abs(typingEnd-phraseEnd)>1/30||keyboard.events.at(-1).frame!==promptScene.start+keys.at(-1).frame)throw Error('Typing and keyboard must finish with spoken example');
if(timing.scenes[0].visual!=='timesaved'||normalize(script.segments.map(s=>s.text).join('')).split('100시간').length!==2)throw Error('100-hour hook must occur only once at the beginning');
const result=spawnSync('ffmpeg',['-v','info','-i',path.join(__dirname,'yuhobuilds_EP01.mp4'),'-af','loudnorm=I=-16:TP=-1.5:LRA=9:print_format=json','-f','null','-'],{encoding:'utf8',windowsHide:true,maxBuffer:4*1024*1024});
if(result.status!==0)throw Error(result.stderr);
const measure=JSON.parse(result.stderr.slice(result.stderr.lastIndexOf('{'),result.stderr.lastIndexOf('}')+1));
// The joke keeps a white heading on black throughout. Catch the observed
// Chromium layer dropout in the encoded frames, not just the React tree.
const joke=timing.scenes.find(s=>s.visual==='joke');
const frameCheck=spawnSync('ffmpeg',['-v','error','-i',path.join(__dirname,'yuhobuilds_EP01.mp4'),'-vf',`select=between(n\\,${joke.start+15}\\,${joke.start+joke.duration-5}),crop=882:410:83:162,scale=88:41,format=gray`,'-fps_mode','passthrough','-an','-f','rawvideo','pipe:1'],{windowsHide:true,maxBuffer:4*1024*1024});
if(frameCheck.status!==0)throw Error(frameCheck.stderr.toString());
const frameBytes=88*41,counts=[];
for(let offset=0;offset<frameCheck.stdout.length;offset+=frameBytes){let bright=0;for(const v of frameCheck.stdout.subarray(offset,offset+frameBytes))if(v>160)bright++;counts.push(bright);}
if(counts.length!==joke.duration-19||Math.min(...counts)<80)throw Error('Joke heading missing from encoded frame: '+JSON.stringify({frames:counts.length,min:Math.min(...counts)}));
const report={createdAt:new Date().toISOString(),captionTextMatches:true,captionCount:captions.length,captionBoundsAndOverlapPassed:true,jokeHeadingFrameAudit:{frames:counts.length,minBrightPixels:Math.min(...counts),passed:true},shortPunchlines:captions.filter(c=>c.endMs-c.startMs<750).map(c=>({text:c.text,durationMs:c.endMs-c.startMs})),finalAac:measure,directListeningVerified:false,publicUpload:false};
report.typing={voiceEndSeconds:phraseEnd,typingEndSeconds:typingEnd,errorMs:Math.round((typingEnd-phraseEnd)*1000),keystrokes:keys.length,soundEndsOnLastKey:true};
report.opening100HoursOnlyOnce=true;
fs.writeFileSync(path.join(__dirname,'검수/최종검수.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({captionCount:captions.length,lufs:measure.input_i,truePeak:measure.input_tp,passed:true}));
