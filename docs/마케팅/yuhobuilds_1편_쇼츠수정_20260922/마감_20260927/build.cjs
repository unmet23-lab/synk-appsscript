'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process'),{createRequire}=require('node:module');
const root=__dirname,base=path.dirname(root),repo=path.resolve(base,'../../..'),video=path.join(repo,'영상');
const audit=path.join(root,'audit'),old=path.join(base,'검수/업로드_20260926'),assets=path.join(root,'assets/sfx'),pub=path.join(root,'public');
const write=(p,d)=>fs.writeFileSync(p,typeof d==='string'?d:JSON.stringify(d,null,2)+'\n');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const run=(cmd,args)=>{const r=spawnSync(cmd,args,{encoding:'utf8',windowsHide:true,maxBuffer:12*1024*1024});if(r.status!==0)throw Error(r.stderr||r.error);return r;};
function loud(p){const t=run('ffmpeg',['-hide_banner','-i',p,'-af','loudnorm=I=-16:TP=-1.5:LRA=9:print_format=json','-f','null','-']).stderr;return JSON.parse(t.slice(t.lastIndexOf('{'),t.lastIndexOf('}')+1));}
function prepare(){
 for(const d of [audit,pub,path.join(root,'audio')])fs.mkdirSync(d,{recursive:true});
 fs.cpSync(path.join(base,'runtime-public'),pub,{recursive:true});
 const timing=read(path.join(old,'final-timing.json')),captions=read(path.join(old,'final-captions.json')),words=read(path.join(old,'final-words.json'));
 const kinds=['none','reveal-up','reveal-left','reveal-left','reveal-up','reveal-right','reveal-left','soft-zoom','reveal-up','reveal-left','soft-zoom','reveal-up','reveal-left','reveal-up','reveal-right','reveal-left','soft-zoom'];
 const reframes={hook:{at:75,scale:1.035,y:-8},setting:{at:67,scale:1.025,x:-7},payment:{at:42,scale:1.04},inquiries:{at:49,scale:1.03,y:-8},purpose:{at:81,scale:1.035,y:-9},tools:{at:74,scale:1.035},zero:{at:78,scale:1.025},loop:{at:83,scale:1.035,y:-8},hours:{at:40,scale:1.035},joke:{at:138,scale:1.045,y:-10},action:{at:70,scale:1.03},signoff:{at:62,scale:1.025,y:-8}};
 timing.scenes=timing.scenes.map((s,i)=>({...s,transition:{kind:kinds[i],frames:i===0?0:kinds[i]==='soft-zoom'?6:9},motionCue:reframes[s.visual]||null}));
 timing.audioFile='yuho-journey-01/narration-finish-20260927.wav';
 const cues=[];
 const sc=v=>timing.scenes.find(s=>s.visual===v);
 function cue(visual,local,name,peakDb,reason,seconds=.3){const s=sc(visual);cues.push({id:`sfx-${String(cues.length+1).padStart(2,'0')}`,scene:s.id,visual,frame:s.start+local,name,peakDb,seconds,reason});}
 for(const visual of ['hook','setting','tools','screenshots','hours','lesson','action','signoff'])cue(visual,0,'whoosh-short',-29,'장면 전환의 방향감',.26);
 cue('timesaved',79,'impact-bass-1',-24,'100시간 숫자 등장',.38);
 cue('hook',75,'pop',-27,'번역에서 앱으로 시선 이동',.19);
 cue('setting',67,'click-soft',-29,'친구 없음 표정 전환',.12);
 cue('payment',42,'chime',-25,'첫 결제 회고 강조',.65);
 cue('inquiries',0,'notification',-27,'첫 문의 카드',.34);
 cue('inquiries',18,'pop',-29,'문의가 쌓이는 박자',.15);
 cue('purpose',33,'ping',-28,'부모님 알림 카드',.24);
 cue('tools',12,'click-soft',-29,'구글 시트 카드 등장',.16);
 cue('zero',3,'impact-bass-1',-26,'제로 반전',.3);
 cue('zero',78,'error',-29,'설정부터 막힌 장면',.32);
 cue('screenshots',26,'click',-25,'화면 찍고',.14);
 cue('screenshots',45,'click-soft',-26,'물어보고',.14);
 cue('screenshots',58,'pop',-27,'따라 하고',.16);
 cue('loop',83,'error',-28,'괴상해진 앱과 놀란 표정',.32);
 cue('hours',40,'click-soft',-28,'17~18시간 숫자 강조',.16);
 cue('joke',43,'click-soft',-29,'앱은요? 반전',.15);
 cue('joke',153,'pop',-28,'탈모빔 농담과 느낌표',.18);
 cue('lesson',88,'ping',-26,'딱 출석 하나부터',.26);
 cue('prompt',71,'click-soft',-30,'첫 질문에 초점',.12);
 cue('prompt',160,'click-soft',-30,'로드맵 문장에 초점',.12);
 cue('shortcut',38,'whoosh-short',-29,'건너뛰는 화살표',.24);
 cue('signoff',84,'chime',-27,'엔딩 멘트',.65);
 cues.sort((a,b)=>a.frame-b.frame);
 const duration=timing.durationInFrames/30;
 const prepared=[];
 for(const c of cues){
  const input=path.join(assets,c.name+'.mp3'),tmp=path.join(root,'audio',c.id+'-trim.wav'),output=path.join(root,'audio',c.id+'.wav');
  // Short editorial one-shots. Remove only lead silence, then end each cue with a fade.
  run('ffmpeg',['-v','error','-y','-i',input,'-af',`silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.003,atrim=duration=${c.seconds},afade=t=in:d=0.004,afade=t=out:st=${c.seconds-.06}:d=0.06,highpass=f=70,lowpass=f=7200`,'-ar','48000','-ac','2','-c:a','pcm_s16le',tmp]);
  const meter=run('ffmpeg',['-hide_banner','-i',tmp,'-af','volumedetect','-f','null','-']).stderr;
  const m=meter.match(/max_volume: ([-.\d]+) dB/);if(!m)throw Error('SFX level missing');
  c.sourceMaxDb=+m[1];c.gainDb=c.peakDb-c.sourceMaxDb;
  run('ffmpeg',['-v','error','-y','-i',tmp,'-af',`volume=${c.gainDb}dB`,'-c:a','pcm_s16le',output]);
  c.file=path.relative(root,output).replaceAll('\\','/');c.source='Bundled media-use SFX';c.sourceSha256=hash(input);prepared.push(output);
 }
 const args=['-y','-v','error'];for(const p of prepared)args.push('-i',p);
 const filters=cues.map((c,i)=>`[${i}:a]adelay=${Math.round(c.frame/30*1000)}:all=1[s${i}]`);
 filters.push(cues.map((c,i)=>`[s${i}]`).join('')+`amix=inputs=${cues.length}:normalize=0,apad,atrim=duration=${duration}[sfx]`);
 const stem=path.join(root,'audio/sfx-stem.wav');args.push('-filter_complex',filters.join(';'),'-map','[sfx]','-c:a','pcm_s16le',stem);run('ffmpeg',args);
 const premix=path.join(root,'audio/premix.wav');
 // The retained premix already contains the original BGM ducking and typed-key alignment.
 run('ffmpeg',['-y','-v','error','-i',path.join(old,'premix.wav'),'-i',stem,'-i',path.join(old,'narration-only.wav'),'-filter_complex','[1:a][2:a]sidechaincompress=threshold=0.035:ratio=2:attack=5:release=80[sfx];[0:a][sfx]amix=inputs=2:duration=first:normalize=0[mix]','-map','[mix]','-c:a','pcm_s16le',premix]);
 const measured=loud(premix),gainDb=Math.min(-16-Number(measured.input_i),-1.5-Number(measured.input_tp));
 const audioOut=path.join(pub,timing.audioFile);run('ffmpeg',['-y','-v','error','-i',premix,'-af',`volume=${gainDb}dB`,'-ar','48000','-ac','2','-c:a','pcm_s16le',audioOut]);
 const props={timing,captions,words};write(path.join(root,'props.json'),props);write(path.join(audit,'sound-cues.json'),cues);
 write(path.join(audit,'edit-record.json'),{date:'2026-09-27',sourceMaster:path.join(base,'업로드_최종_20260926/yuhobuilds_EP01_FINAL_1080x1920.mp4'),sourceSha256:hash(path.join(base,'업로드_최종_20260926/yuhobuilds_EP01_FINAL_1080x1920.mp4')),narrationSourceSha256:hash(path.join(old,'narration-only.wav')),originalPremixSha256:hash(path.join(old,'premix.wav')),subtitleSourceSha256:hash(path.join(old,'final-captions.json')),narrationChanged:false,newNarration:false,newSounds:cues.length,visualTransitions:timing.scenes.length-1,transitionFrames:timing.scenes.slice(1).map(s=>({id:s.id,...s.transition})),registryReference:'refs/compositions/components/directional-wipe.html',registryAdaptation:'Restrained reveal + small depth movement, frame driven in existing Remotion project; removed RGB split and light flashes.',timingUnchanged:true,gainDb,loudness:loud(audioOut),directListeningVerified:false,publicUpload:false});
 fs.copyFileSync(path.join(base,'업로드_최종_20260926/yuhobuilds_EP01_자막.srt'),path.join(root,'yuhobuilds_EP01_자막.srt'));
 fs.copyFileSync(path.join(base,'업로드_최종_20260926/yuhobuilds_EP01_COVER.png'),path.join(root,'yuhobuilds_EP01_COVER.png'));
 console.log(JSON.stringify({prepared:true,frames:timing.durationInFrames,cues:cues.length,gainDb,lufs:loud(audioOut).input_i}));
}
async function render(mode){
 const props=read(path.join(root,'props.json'));
 const requireVideo=createRequire(path.join(video,'package.json')),{bundle}=requireVideo('@remotion/bundler'),{getCompositions,renderMedia,renderStill,openBrowser}=requireVideo('@remotion/renderer');
 const url=await bundle({entryPoint:path.join(video,'src/yuhoShorts01/finish20260927/entry.tsx'),rootDir:video,publicDir:pub});
 const browser=await openBrowser('chrome',{chromiumOptions:{gl:'swangle'}}),errors=[];
 const onBrowserLog=m=>{if(/Failed to load|net::ERR_|Error loading|Could not load font/.test(m.text||''))errors.push(m.text);};
 try{
  const comps=await getCompositions(url,{inputProps:props,puppeteerInstance:browser,logLevel:'error',onBrowserLog});
  const comp=comps.find(c=>c.id==='YuhoJourney01');
  if(mode==='review'){
   const frames=[125,129,134,1132,1177,1530,1590,1699,1770,1790,2070,2150];
   const dir=path.join(audit,'preflight');fs.mkdirSync(dir,{recursive:true});
   for(const frame of frames){await renderStill({serveUrl:url,composition:comp,inputProps:props,output:path.join(dir,`frame-${frame}.png`),frame,scale:.5,puppeteerInstance:browser,onBrowserLog,logLevel:'error'});}
   write(path.join(audit,'preflight.json'),{frames,errors});console.log('Preflight stills rendered');
  }else{
   let last=-1;
   await renderMedia({serveUrl:url,composition:comp,inputProps:props,outputLocation:path.join(root,'yuhobuilds_EP01_FINISH_1080x1920.mp4'),codec:'h264',pixelFormat:'yuv420p',imageFormat:'jpeg',jpegQuality:95,videoBitrate:'9M',encodingMaxRate:'14M',encodingBufferSize:'20M',audioBitrate:'256k',colorSpace:'bt709',concurrency:3,puppeteerInstance:browser,onBrowserLog,enforceAudioTrack:true,overwrite:true,logLevel:'error',onProgress:p=>{const n=Math.floor(p.progress*20)*5;if(n!==last){last=n;console.log(`Render ${n}%`);}}});
   write(path.join(audit,'render.json'),{finishedAt:new Date().toISOString(),errors,frames:comp.durationInFrames});
  }
  if(errors.length)throw Error(errors.join('\n'));
 }finally{await browser.close({silent:true});}
}
const mode=process.argv[2]||'prepare';
(async()=>{if(mode==='prepare')prepare();else await render(mode)})().catch(e=>{console.error(e.stack);process.exitCode=1});
