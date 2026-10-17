'use strict';
// 배경 한 파일과 무대 목록만 교체. 송출 코드, 소리, 현재 DJ 자산은 업로드하지 않는다.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{createHash}=require('node:crypto'),{execFileSync}=require('node:child_process');
const v4=process.argv.includes('--v4');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/_ops/라디오생동_20260909/'+(v4?'v4':'v3'));
const base=JSON.parse(fs.readFileSync(path.join(out,'배포전상태.json'),'utf8')).server;
const file=path.join(root,'docs/라디오/무대영상/'+(v4?'추석_나무고정_조명_20260909.mp4':'추석_영상생성_20260909.mp4'));
const sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const key=path.join(os.homedir(),'.ssh/synk_radio'),host='synk-radio';
const mode=process.argv.slice(2).find(a=>a!=='--v4')||'--check';if(!['--upload','--check','--apply'].includes(mode))throw new Error('잘못된 실행 모드');
const fileSha=sha(file),target='/opt/synk-radio/무대차례/'+(v4?'chuseok-tree-light-20260909-':'chuseok-generated-20260909-')+fileSha.slice(0,12)+'.mp4';
const incoming=mode==='--upload'?target+'.upload-'+require('node:crypto').randomUUID():null;
const payload={apply:mode==='--apply',target,incoming,sha256:fileSha,oldStageSha:base.stagePlaylist.sha256,stage:base.stagePlaylist.path,backupSuffix:'.before-generated-20260909'+(v4?'-v4':''),nextSuffix:'.generated-next-'+require('node:crypto').randomUUID(),
 protected:[base.tuningFile,base.audioPlaylist,...Object.values(base.codeFiles),...Object.values(base.currentDJAssets)].map(x=>({path:x.path,sha256:x.sha256}))};
if(mode==='--upload')execFileSync('scp',['-i',key,file,host+':'+incoming],{stdio:'inherit',timeout:180000});
const remote=String.raw`
const fs=require('fs'),cp=require('child_process'),crypto=require('crypto'),assert=require('assert/strict');
(async()=>{
const p=JSON.parse(process.argv[1]),hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const check=()=>{for(const f of p.protected)assert.equal(hash(f.path),f.sha256,'현재 소리/DJ/코드 변경 감지: '+f.path);};
check();
if(p.incoming){assert.equal(hash(p.incoming),p.sha256);if(fs.existsSync(p.target)){assert.equal(hash(p.target),p.sha256);fs.unlinkSync(p.incoming);}else fs.renameSync(p.incoming,p.target);}
assert.equal(hash(p.target),p.sha256);
const probe=JSON.parse(cp.execFileSync('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_type,codec_name,width,height,r_frame_rate','-of','json',p.target],{encoding:'utf8'}));
assert.equal(probe.streams.length,1);assert.equal(probe.streams[0].codec_name,'h264');assert.equal(probe.streams[0].width,1280);assert.equal(probe.streams[0].height,720);assert.equal(probe.streams[0].r_frame_rate,'30/1');assert.ok(Math.abs(Number(probe.format.duration)-60)<.08);
const list='ffconcat version 1.0\n'+Array(20).fill("file '"+require('path').basename(p.target)+"'").join('\n')+'\n';
const newSha=crypto.createHash('sha256').update(list).digest('hex'),current=hash(p.stage),already=current===newSha;
assert.ok(already||current===p.oldStageSha,'무대 목록 동시 변경 감지');
const backup=p.stage+p.backupSuffix;
let restarted=false;
const snapshot=()=>{
 const service=Object.fromEntries(cp.execFileSync('systemctl',['show','radio-live','--property=MainPID,ActiveState,ActiveEnterTimestamp,NRestarts'],{encoding:'utf8'}).trim().split('\n').map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1)];}));
 const files=[];let children=[];try{children=cp.execFileSync('pgrep',['-P',service.MainPID],{encoding:'utf8'}).trim().split('\n');}catch{}
 for(const pid of children){try{for(const fd of fs.readdirSync('/proc/'+pid+'/fd')){try{const f=fs.readlinkSync('/proc/'+pid+'/fd/'+fd);if(/\.(mp4|flac)$/.test(f))files.push(f);}catch{}}}catch{}}
 return {service,files};
};
const before=snapshot();
if(p.apply&&!already){
 if(fs.existsSync(backup))assert.equal(hash(backup),p.oldStageSha);else fs.copyFileSync(p.stage,backup);
 fs.writeFileSync(p.stage+p.nextSuffix,list);fs.renameSync(p.stage+p.nextSuffix,p.stage);
}
if(p.apply&&(before.service.ActiveState!=='active'||!before.files.includes(p.target))){check();cp.execFileSync('sudo',['-n','systemctl','restart','radio-live']);restarted=true;}
let after=snapshot();
if(p.apply){for(let i=0;i<20&&(after.service.ActiveState!=='active'||!after.files.includes(p.target));i++){await new Promise(r=>setTimeout(r,1500));after=snapshot();}assert.equal(after.service.ActiveState,'active');assert.ok(after.files.includes(p.target),'새 배경을 실제로 연 송출 프로세스가 아직 없다');if(restarted)assert.notEqual(after.service.MainPID,before.service.MainPID);}
check();console.log(JSON.stringify({applied:p.apply&&after.files.includes(p.target),already,restarted,at:new Date().toISOString(),file:p.target,sha256:hash(p.target),stageSha256:hash(p.stage),backup,protectedFilesUnchanged:p.protected.length,probe,before,after},null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
`;
const data=Buffer.from(JSON.stringify(payload)).toString('base64'),code=Buffer.from(remote).toString('base64');
const command=`node -e 'process.argv[1]=Buffer.from("${data}","base64").toString();eval(Buffer.from("${code}","base64").toString())'`;
const result=JSON.parse(execFileSync('ssh',['-i',key,host,command],{encoding:'utf8',timeout:60000}));
if(mode==='--apply')fs.writeFileSync(path.join(out,'라이브반영.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
