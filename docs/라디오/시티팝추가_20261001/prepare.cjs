'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process'),crypto=require('crypto'),assert=require('assert/strict');
const dir=__dirname,root=path.resolve(dir,'../../..'),key=path.join(os.homedir(),'.ssh/synk_radio'),host='synk@34.71.111.97';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const audio=JSON.parse(fs.readFileSync(path.join(dir,'audio-build.json'),'utf8'));
const remote=`const fs=require('fs'),cp=require('child_process'),crypto=require('crypto');const root='/opt/synk-radio/';const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');const playlist=fs.readFileSync(root+'소리/playlist.txt','utf8'),manifest=fs.readFileSync(root+'소리/now-playing.json','utf8');const names=[...playlist.matchAll(/^file (.+)$/gm)].map(m=>m[1]);const files=names.map(name=>({name,sha256:hash(root+'소리/'+name),probe:JSON.parse(cp.execFileSync('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_name,sample_fmt,sample_rate,channels,bits_per_raw_sample','-of','json',root+'소리/'+name],{encoding:'utf8'}))}));console.log(JSON.stringify({at:new Date().toISOString(),playlist,manifest,playlistSha256:hash(root+'소리/playlist.txt'),manifestSha256:hash(root+'소리/now-playing.json'),files,configSha256:hash(root+'송출/조율.json'),streamCodeSha256:hash(root+'지면/bots/오버레이/겹쳐송출.js'),titleCodeSha256:hash(root+'지면/bots/오버레이/현재곡.js'),status:cp.execFileSync('systemctl',['show','radio-live','-p','ActiveState','-p','MainPID','-p','NRestarts'],{encoding:'utf8'})}));`;
const before=JSON.parse(cp.execFileSync('ssh',['-i',key,host,'node'],{input:remote,encoding:'utf8',timeout:60000}));
fs.writeFileSync(path.join(dir,'server-before.json'),JSON.stringify(before,null,2));
fs.writeFileSync(path.join(dir,'playlist-before.txt'),before.playlist);
fs.writeFileSync(path.join(dir,'manifest-before.json'),before.manifest);
const old=JSON.parse(before.manifest);assert.equal(old.tracks.length,19);assert.equal(sha(Buffer.from(before.playlist)),old.playlistSha256);
for(const f of [...before.files,{probe:audio.probe}]){const s=f.probe.streams[0];assert.equal(s.codec_name,'flac');assert.equal(s.sample_rate,'44100');assert.equal(s.channels,2);assert.equal(s.bits_per_raw_sample,'24');}
const localOld=[path.resolve(root,'../SYNK-radio-20260926/소리/synk-radio-new8-20260926.flac'),path.join(root,'docs/라디오/곡제목_모음집_20260927/old11.flac')];
before.files.forEach((f,i)=>assert.equal(sha(fs.readFileSync(localOld[i])),f.sha256,'Local old audio differs'));
const newName=path.basename(audio.output),newLine=`file ${newName}\nduration ${audio.duration}\n`;
const finalPlaylist=before.playlist+(before.playlist.endsWith('\n')?'':'\n')+newLine;
let start=old.duration;const newTracks=audio.tracks.map(t=>{const out={start,title:t.title};start+=t.normalizedDuration-audio.crossfadeSeconds;return out;});
const final={...old,duration:old.duration+audio.duration,playlistSha256:sha(Buffer.from(finalPlaylist)),tracks:[...old.tracks,...newTracks],sourceNotes:old.sourceNotes+'; 2026-10-01: delivered Korean citypop3 appended; 3s internal crossfades, unchanged original19.'};
const trialPlaylist='ffconcat version 1.0\n'+newLine+before.playlist.replace(/^ffconcat version 1.0\r?\n/,'');
const trial={...final,playlistSha256:sha(Buffer.from(trialPlaylist)),tracks:[...newTracks.map(t=>({...t,start:t.start-old.duration})),...old.tracks.map(t=>({...t,start:t.start+audio.duration}))]};
for(const [name,playlist,manifest] of [['final',finalPlaylist,final],['trial',trialPlaylist,trial]]){
    fs.writeFileSync(path.join(dir,`playlist-${name}.txt`),playlist);
    fs.writeFileSync(path.join(dir,`now-playing-${name}.json`),JSON.stringify(manifest,null,2)+'\n');
    const now=require(path.join(root,'bots/오버레이/현재곡.js'));now.검증(manifest);
    assert.equal(manifest.tracks.length,22);assert.equal(now.찾기(manifest,manifest.duration+0.1).title,manifest.tracks[0].title);
}
const joins=[{name:'old19-to-citypop3',left:localOld[1],right:audio.output},{name:'citypop3-to-first-song',left:audio.output,right:localOld[0]}];
for(const j of joins){
    const duration=Number(JSON.parse(cp.execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','json',j.left],{encoding:'utf8'})).format.duration);
    const concat=path.join(dir,j.name+'.ffconcat');fs.writeFileSync(concat,`ffconcat version 1.0\nfile '${j.left.replace(/\\/g,'/')}'\nduration ${duration}\nfile '${j.right.replace(/\\/g,'/')}'\n`);
    const result=cp.spawnSync('ffmpeg',['-hide_banner','-v','warning','-xerror','-f','concat','-safe','0','-i',concat,'-ss',String(duration-8),'-t','30','-af','asetpts=N/SR/TB','-c:a','aac','-ar','44100','-ac','2','-f','null','NUL'],{encoding:'utf8',timeout:60000});
    assert.equal(result.status,0,result.stderr);assert.equal(result.stderr.trim(),'');j.decodedSeconds=30;j.errors=0;
}
const result={at:new Date().toISOString(),existingTitlesPreserved:JSON.stringify(final.tracks.slice(0,19))===JSON.stringify(old.tracks),existingAudioPreserved:true,format:'44.1kHz stereo FLAC 24-bit',joins,newTracks,duration:final.duration,finalPlaylistSha256:final.playlistSha256,trialPlaylistSha256:trial.playlistSha256};
fs.writeFileSync(path.join(dir,'preflight.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
