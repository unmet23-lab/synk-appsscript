'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawnSync}=require('child_process');
const root=path.resolve(__dirname,'../../..'),qa=path.join(__dirname,'_검토/로고반영');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,'')),save=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const ids=(process.argv.find(x=>x.startsWith('--ids='))||'').slice(6).split(',').filter(Boolean);
if(!ids.length)throw Error('Explicit inspected film IDs required');
const deliveries=[];
for(const id of ids){
 const dir=path.join(qa,id==='01-lab-youtube'||process.argv.includes('--full')?id:'기존6편/'+id),proofPath=path.join(dir,'verification.json'),p=read(proofPath);
 if(!p.fullDecode||!p.audioStreamIdentical)throw Error('Candidate unverified '+id);
 const candidate=path.join(dir,'video.mp4'),target=path.join(__dirname,id,'video.mp4');
 if(sha(candidate)!==p.sha256)throw Error('Candidate changed '+id);
 if(sha(target)!==p.sourceSha256)throw Error('Current movie changed '+id);
 const output=spawnSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',candidate],{encoding:'utf8',windowsHide:true});if(output.status!==0)throw Error(output.stderr);
 const facts=JSON.parse(output.stdout),v=facts.streams.find(s=>s.codec_type==='video');
 if(Number(v.nb_frames)!==p.frames||v.r_frame_rate!=='30/1')throw Error('Frame timeline changed '+id);
 const old=path.join(dir,'previous-'+p.sourceSha256+'.mp4');if(!fs.existsSync(old))fs.copyFileSync(target,old);
 fs.copyFileSync(candidate,target);p.visualInspection='Actual complete frames, logo edges, scene entry/exit inspected; no visible panel seam or clipped letters';p.appliedAt=new Date().toISOString();save(proofPath,p);
 const activePath=path.join(__dirname,'_검토/video',id,'verification.json'),active=read(activePath);save(path.join(dir,'previous-verification.json'),active);
 active.sha256=p.sha256;active.logoReplacement={report:path.relative(__dirname,proofPath).replaceAll('\\','/'),previousSha256:p.sourceSha256,audioStreamIdentical:true,fullDecode:true,at:p.appliedAt};save(activePath,active);
 deliveries.push({id,sha256:sha(target),frames:Number(v.nb_frames),duration:Number(v.duration),width:v.width,height:v.height,audioStreamIdentical:true});
}
const summaryPath=path.join(qa,'납품반영.json'),summary=fs.existsSync(summaryPath)?read(summaryPath):{films:[]};
summary.at=new Date().toISOString();summary.films=[...summary.films.filter(x=>!ids.includes(x.id)),...deliveries];save(summaryPath,summary);
const auditPath=path.join(__dirname,'_검토/납품실물검증.json'),audit=read(auditPath);
for(const d of deliveries){const item=audit.records.find(x=>x.id===d.id);if(item?.video)item.video={...item.video,sha256:d.sha256,duration:d.duration,width:d.width,height:d.height};}
audit.logoOnlyRefreshedAt=summary.at;save(auditPath,audit);console.log(JSON.stringify(deliveries));
