const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=__dirname,T=JSON.parse(fs.readFileSync(path.join(root,'timing.json'),'utf8')),audio=path.join(root,'audio/sfx');fs.mkdirSync(audio,{recursive:true});
const run=(args)=>{const r=spawnSync('ffmpeg',args,{encoding:'utf8',windowsHide:true,maxBuffer:12e6});if(r.status!==0)throw Error(r.stderr);return r.stderr;};
const library='C:/Users/q1212/.agents/skills/media-use/audio/assets/sfx';
const word=(id,t)=>{const s=T.segments.find(s=>s.id===id),w=s.words.find(w=>w.text.includes(t));return s.start+(w?.start??0);};
const cues=[];const add=(time,name,peak=-28,d=.22)=>cues.push({time,name,peak,d});
for(const id of ['origin','loop','reset','prompt','payoff'])add(T.scenes.find(s=>s.id===id).start,'whoosh-short',-29,.23);
add(word('01','까먹은'),'error',-25,.30);add(word('02','한'),'pop',-28,.16);
add(word('04','학생'),'notification',-27,.30);add(word('04','출석'),'ping',-27,.24);
add(word('05','하나도'),'impact-bass-1',-27,.26);
add(word('06','화면'),'click',-26,.12);add(word('06','물어보고'),'click-soft',-27,.12);add(word('06','그대로'),'pop',-27,.16);
const monster=T.scenes.find(s=>s.id==='monster').start;for(let i=0;i<4;i++)add(monster+.19+i*.36,i%2?'pop':'click-soft',-28+i*.4,.16);
add(word('08','정작'),'error',-26,.32);add(word('09','한'),'whoosh-short',-29,.24);
add(word('11','이름을'),'click-soft',-27,.12);add(word('11','저장'),'click',-25,.13);add(word('11','저장')+.14,'ping',-28,.25);
add(word('12','다시'),'whoosh-short',-31,.24);add(word('12','기록이'),'chime',-25,.5);
for(const [i,c] of T.characters.filter(c=>['13','14','15'].includes(c.segment)&&c.text.trim()).entries()){if(i%4===0)add(c.end,'click-soft',-32,.065);}
for(const s of ['작게','확인한','다음'])add(word('16',s),'pop',-28,.13);
add(word('18','아껴드립니다'),'chime',-29,.53);
cues.sort((a,b)=>a.time-b.time);const paths=[];
for(let i=0;i<cues.length;i++){const c=cues[i],input=path.join(library,c.name+'.mp3'),temp=path.join(audio,i+'-trim.wav'),out=path.join(audio,i+'.wav');
 run(['-v','error','-y','-i',input,'-af',`silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.003,atrim=duration=${c.d},afade=t=in:d=0.004,afade=t=out:st=${Math.max(.008,c.d-.04)}:d=0.04,highpass=f=80,lowpass=f=7000`,'-ar','48000','-ac','2',temp]);
 const m=run(['-hide_banner','-i',temp,'-af','volumedetect','-f','null','-']).match(/max_volume: ([-\d.]+) dB/);if(!m)throw Error('SFX level unavailable');
 run(['-y','-v','error','-i',temp,'-af',`volume=${c.peak-Number(m[1])}dB`,out]);paths.push(out);
}
const args=['-y','-v','error'];paths.forEach(p=>args.push('-i',p));const filters=cues.map((c,i)=>`[${i}:a]adelay=${Math.round(c.time*1000)}:all=1[a${i}]`);filters.push(cues.map((c,i)=>`[a${i}]`).join('')+`amix=inputs=${cues.length}:normalize=0,apad,atrim=duration=${T.duration}[out]`);args.push('-filter_complex',filters.join(';'),'-map','[out]',path.join(root,'assets/sfx.wav'));run(args);
run(['-v','error','-y','-stream_loop','-1','-i',path.join(root,'assets/music-source.wav'),'-t',String(T.duration),'-af',`rubberband=tempo=1.2:pitch=1,loudnorm=I=-28.5:TP=-6:LRA=8,afade=t=in:d=0.25,afade=t=out:st=${T.duration-.8}:d=0.8`,'-ar','48000','-ac','2',path.join(root,'assets/music.wav')]);
fs.writeFileSync(path.join(root,'audit/sfx-cues.json'),JSON.stringify(cues,null,2));
console.log('Audio prepared: '+cues.length+' cues, music at -29 LUFS before spectral carve.');
