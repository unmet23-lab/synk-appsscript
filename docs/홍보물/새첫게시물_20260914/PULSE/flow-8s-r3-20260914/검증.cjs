'use strict';
// Usage: node 검증.cjs <downloaded-video.mp4>
// Read/copy/decode local media only. Never generates, uploads, or controls a browser.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
if(process.argv.length!==3) throw Error('Usage: node 검증.cjs <downloaded-video.mp4>');
const downloaded=path.resolve(process.argv[2]);
if(path.extname(downloaded).toLowerCase()!=='.mp4'||!fs.statSync(downloaded).isFile()) throw Error('Expected a local MP4 file');
const original=path.join(__dirname,path.basename(downloaded));
const bin='C:/Users/q1212/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.2-full_build/bin';
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const sources=['pulse-slide-start.png','pulse-slide-end.png','프롬프트.md'].map(file=>({file,sha256:hash(path.join(__dirname,file))}));
if(!fs.existsSync(original)) fs.copyFileSync(downloaded,original,fs.constants.COPYFILE_EXCL);
if(hash(downloaded)!==hash(original)) throw Error('Existing preserved copy differs from the supplied source; refusing overwrite');
const probe=JSON.parse(execFileSync(path.join(bin,'ffprobe.exe'),['-v','error','-count_frames','-show_streams','-show_format','-of','json',original],{encoding:'utf8'}));
fs.writeFileSync(path.join(__dirname,'ffprobe.json'),JSON.stringify(probe,null,2));
execFileSync(path.join(bin,'ffmpeg.exe'),['-nostdin','-v','error','-xerror','-i',original,'-map','0','-f','null','-'],{encoding:'utf8'});
const duration=Number(probe.format.duration);
if(!Number.isFinite(duration)||duration<7.9) throw Error('Video is shorter than the requested 8-second inspection range');
const framesDir=path.join(__dirname,'frames');
fs.mkdirSync(framesDir,{recursive:true});
const frames=[];
for(const seconds of [0,0.5,1,1.5,2,2.5,3,3.5,4,4.5,5,5.5,6,6.5,7,7.5,7.9]){
  const file=`frame-${String(seconds).replace('.','_')}s.png`;
  const target=path.join(framesDir,file);
  execFileSync(path.join(bin,'ffmpeg.exe'),['-nostdin','-v','error','-y','-ss',String(seconds),'-i',original,'-frames:v','1','-update','1',target]);
  frames.push({seconds,file:'frames/'+file,bytes:fs.statSync(target).size,sha256:hash(target)});
}
const result={checkedAt:new Date().toISOString(),scope:'Third candidate: original preservation, probe, full-stream decode and requested frame extraction only; no hearing, continuous playback or artistic pass claim',downloaded,original:path.basename(original),bytes:fs.statSync(original).size,sha256:hash(original),downloadPreserved:true,sources,fullDecode:{passed:true,command:'ffmpeg -nostdin -v error -xerror -i <original> -map 0 -f null -',exitCode:0},streams:probe.streams.map(s=>({codec_type:s.codec_type,codec_name:s.codec_name,width:s.width,height:s.height,pix_fmt:s.pix_fmt,r_frame_rate:s.r_frame_rate,nb_read_frames:s.nb_read_frames,duration:s.duration,sample_rate:s.sample_rate,channels:s.channels})),duration:probe.format.duration,frames};
fs.writeFileSync(path.join(__dirname,'기술검증.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
