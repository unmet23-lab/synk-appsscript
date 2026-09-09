'use strict';
// 공개 유튜브 수신본만 유한 길이로 저장한다. 재생 주소/서명 쿼리는 출력하지 않는다.
const fs=require('node:fs'),path=require('node:path'),{spawn,execFileSync}=require('node:child_process');
const out=path.resolve(__dirname,'../docs/_ops/라디오생동_20260909/v2');
const duration=Number(process.argv[2]||90),name=process.argv[3]||'유튜브수신';
const withVideo=process.argv.includes('--video');
if(!Number.isFinite(duration)||duration<10||duration>300||!/^[-\w가-힣]+$/.test(name))throw new Error('검수 범위 오류');
const mask=s=>String(s).replace(/https?:\/\/[^\s"']+/g,'[수신 주소 생략]');
function run(cmd,args,limitMs){return new Promise((resolve,reject)=>{
  const p=spawn(cmd,args,{windowsHide:true});let stdout='',stderr='';
  p.stdout.on('data',d=>stdout+=d);p.stderr.on('data',d=>stderr+=d);
  const timer=setTimeout(()=>{p.kill();reject(new Error('검수 시간 한계'));},limitMs);
  p.on('error',reject);p.on('close',code=>{clearTimeout(timer);code===0?resolve({stdout,stderr}):reject(new Error(mask(stderr).slice(-2000)));});
});}
(async()=>{
  fs.mkdirSync(out,{recursive:true});const started=new Date().toISOString();
  const result=await run('yt-dlp',['--no-playlist','--js-runtimes','node','--dump-single-json','--skip-download','-f',withVideo?'bestvideo[height<=720]+bestaudio':'bestaudio','https://www.youtube.com/watch?v=eI-5vSy5mjY'],90000);
  const info=JSON.parse(result.stdout),formats=info.requested_formats||[info];
  if(formats.some(f=>!f.url))throw new Error('수신 주소가 없다');
  console.log('유튜브 실제 수신 '+duration+'초 검수 시작: '+info.id);
  const video=path.join(out,name+(withVideo?'.mp4':'.m4a'));
  const inputArgs=formats.flatMap(f=>['-rw_timeout','15000000','-i',f.url]);
  const capture=await run('ffmpeg',['-hide_banner','-loglevel','warning',...inputArgs,'-t',String(duration),'-map','0:v:0?','-map',withVideo?'1:a:0':'0:a:0','-c','copy','-movflags','+faststart','-y',video],(duration+90)*1000);
  const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','format=duration,size:stream=codec_name,width,height,sample_rate','-of','json',video],{encoding:'utf8'}));
  const sound=await run('ffmpeg',['-hide_banner','-i',video,'-vn','-af','silencedetect=n=-45dB:d=0.03','-f','null','-'],30000);
  const silence=sound.stderr.split(/\r?\n/).filter(x=>x.includes('silence_'));
  fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify({started,finished:new Date().toISOString(),videoId:info.id,formatId:info.format_id,secondsRequested:duration,probe,silence,captureWarnings:mask(capture.stderr),source:'YouTube public playback, not local preview'},null,2));
  console.log(JSON.stringify({file:video,probe,silence},null,2));
})().catch(e=>{console.error(mask(e.message));process.exitCode=1;});
