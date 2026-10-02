'use strict';
// Finish only this revision's new WAVs: mono measurement, transparent fixed gain,
// then independent output measurement. Generated downloads remain untouched.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const pkg=__dirname,qa=path.join(pkg,'_검토/02-나머지일관화'),base=path.join(pkg,'audio');
const manifestPath=path.join(qa,'음성-manifest.json'),hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
function put(p,v){const temp=p+'.'+process.pid+'.tmp';fs.writeFileSync(temp,v);if(p.endsWith('.json'))JSON.parse(fs.readFileSync(temp,'utf8'));fs.renameSync(temp,p)}
function run(cmd,args){return new Promise((resolve,reject)=>{const p=spawn(cmd,args,{windowsHide:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='';p.stdout.on('data',d=>stdout+=d);p.stderr.on('data',d=>stderr+=d);p.on('error',reject);p.on('close',code=>code?reject(Error(stderr.slice(-1500))):resolve({stdout,stderr}));})}
async function measure(file,mono){const {stderr}=await run('ffmpeg',['-v','info','-i',file,'-af',(mono?'aformat=channel_layouts=mono,':'')+'loudnorm=I=-23:TP=-6:LRA=7:print_format=json','-f','null','NUL']);const rows=stderr.match(/\{[\s\S]*?"input_i"[\s\S]*?\}/g);if(!rows?.length)throw Error('Missing loudness measurement');const p=JSON.parse(rows.at(-1));return {integratedLUFS:Number(p.input_i),truePeakDbTP:Number(p.input_tp),loudnessRangeLU:Number(p.input_lra),thresholdLUFS:Number(p.input_thresh)}}
async function main(){
 const manifest=read(manifestPath);
 if(manifest.completedUnique!==manifest.requestedUnique||manifest.errors.length)throw Error('Generation must finish before level finalization');
 const completed=new Map(),levels=[];
 for(const item of manifest.items){
  if(completed.has(item.file))continue;
  const recordPath=path.join(base,item.file.replace('.wav','.json')),r=read(recordPath),source=path.join(base,r.sourceFile),wav=path.join(base,r.file);
  if(!r.file.startsWith('voice-consistent-')||hash(source)!==r.sourceSha256)throw Error('Unexpected own source or changed native download');
  const sourceLevel=await measure(source,true),wanted=-23-sourceLevel.integratedLUFS,peakRoom=-6-sourceLevel.truePeakDbTP,gainDb=Math.min(wanted,peakRoom);
  if(!Number.isFinite(gainDb))throw Error('Cannot normalize silent/invalid source '+r.file);
  const tmp=wav+'.level-'+process.pid+'.tmp';
  await run('ffmpeg',['-y','-v','error','-i',source,'-af','aformat=channel_layouts=mono,volume='+gainDb.toFixed(8)+'dB','-c:a','pcm_s24le','-f','wav',tmp]);
  await run('ffmpeg',['-v','error','-xerror','-i',tmp,'-f','null','NUL']);
  const outputLevel=await measure(tmp,false),facts=JSON.parse((await run('ffprobe',['-v','error','-show_entries','stream=sample_rate,channels,bits_per_sample,codec_name:format=duration','-of','json',tmp])).stdout);
  if(Number(facts.streams[0].sample_rate)!==48000||facts.streams[0].codec_name!=='pcm_s24le'||outputLevel.truePeakDbTP> -5.95)throw Error('Level/format check failed '+r.file);
  fs.renameSync(tmp,wav);
  const updated={...r,sha256:hash(wav),deliveryProbe:facts,loudness:{sourceMono:sourceLevel,output:outputLevel,constantGainDb:gainDb,targetLUFS:-23,truePeakLimitDbTP:-6,limitedByTruePeak:peakRoom<wanted},processing:'Native 48kHz source preserved. Measure after mono conversion, apply one constant gain, and verify output. No speed change, dynamics compression, trimming or additional frequency upsampling. 24-bit delivery does not claim added generated detail.',fullDecode:true,levelFinalizedAt:new Date().toISOString()};
  put(recordPath,JSON.stringify(updated,null,2));completed.set(r.file,updated);levels.push({file:r.file,sha256:updated.sha256,...updated.loudness});
  console.log(JSON.stringify({file:r.file,LUFS:outputLevel.integratedLUFS,peak:outputLevel.truePeakDbTP,gainDb}));
 }
 manifest.items=manifest.items.map(item=>({...item,...completed.get(item.file)}));manifest.levelFinalization={at:new Date().toISOString(),count:completed.size,method:'Two-stage mono loudness measurement and fixed-gain normalization; video gain still unapplied.'};
 put(manifestPath,JSON.stringify(manifest,null,2));put(path.join(qa,'음성-levels.json'),JSON.stringify({items:levels,humanListening:false},null,2));
 console.log(JSON.stringify({finalized:completed.size,manifest:manifestPath}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
