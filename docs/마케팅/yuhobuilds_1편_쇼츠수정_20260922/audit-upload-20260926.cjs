'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const base=__dirname, input=path.join(base,'yuhobuilds_EP01.mp4');
const out=path.join(base,'검수','업로드_20260926');fs.mkdirSync(out,{recursive:true});
function run(args){const r=spawnSync('ffmpeg',args,{encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024});if(r.status!==0)throw Error(r.stderr);return r.stderr;}
const timing=require('./장면타이밍.json');
const frames=[0,20,60,105,...timing.scenes.slice(1).map(s=>s.start+Math.round(s.duration*.55)),1065,1098,1130,1350,1425,1638,1710,1755,1768,1790,1825,2240,2281].sort((a,b)=>a-b).filter((n,i,a)=>!i||a[i-1]!==n);
const manifest=frames.map((frame,i)=>({image:`frame-${String(i+1).padStart(3,'0')}.jpg`,frame,seconds:frame/30}));
fs.writeFileSync(path.join(out,'frame-manifest.json'),JSON.stringify(manifest,null,2));
run(['-hide_banner','-v','error','-y','-i',input,'-vf',`select=${frames.map(n=>`eq(n\\,${n})`).join('+')},scale=360:640`,'-fps_mode','vfr','-q:v','2',path.join(out,'frame-%03d.jpg')]);
for(let i=0;i<Math.ceil(frames.length/12);i++)run(['-v','error','-y','-start_number',String(1+i*12),'-i',path.join(out,'frame-%03d.jpg'),'-vf','tile=4x3:nb_frames=12:padding=3:margin=3:color=gray','-frames:v','1','-q:v','2',path.join(out,`contact-${i+1}.jpg`)]);
const decodeLog=run(['-hide_banner','-v','info','-i',input,'-vf','blackdetect=d=0.08:pix_th=0.08:pic_th=0.98','-af','silencedetect=noise=-50dB:d=0.4','-f','null','-']);
fs.writeFileSync(path.join(out,'decode-black-silence.txt'),decodeLog);
const boxes=[];const fd=fs.openSync(input,'r'),len=fs.statSync(input).size,b=Buffer.alloc(16);let pos=0;
while(pos+8<=len){fs.readSync(fd,b,0,16,pos);let size=b.readUInt32BE(0);const type=b.toString('ascii',4,8);if(size===1)size=Number(b.readBigUInt64BE(8));if(size===0)size=len-pos;boxes.push({type,offset:pos,bytes:size});if(size<8)throw Error('Invalid MP4 box');pos+=size;}fs.closeSync(fd);
const report={createdAt:new Date().toISOString(),input,frames:frames.length,fullDecodePassed:true,blackIntervals:decodeLog.split('\n').filter(s=>s.includes('black_start:')),silenceIntervals:decodeLog.split('\n').filter(s=>s.includes('silence_start:')||s.includes('silence_end:')),fastStart:boxes.find(b=>b.type==='moov').offset<boxes.find(b=>b.type==='mdat').offset,boxes};
fs.writeFileSync(path.join(out,'file-audit.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
