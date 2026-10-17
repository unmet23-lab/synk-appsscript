'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const dir=__dirname,root=path.resolve(dir,'..','..','..');
const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const payload={target:'/opt/synk-radio/지면/bots/오버레이/마스코트.html',stageList:'/opt/synk-radio/무대차례/목록.txt',stageVideo:manifest.stage.remotePath,audio:'/opt/synk-radio/소리/synk-radio-blok11-20260909-gapless.flac',overlaySha:manifest.candidate.sha256,stageListSha:manifest.stage.listSha256,hanbokPath:manifest.removedAsset.remotePath,hanbokSha:manifest.removedAsset.sha256};
const code=String.raw`
const fs=require('fs'),cp=require('child_process'),crypto=require('crypto'),assert=require('assert/strict');
const p=globalThis.p;const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const props=name=>Object.fromEntries(cp.execFileSync('systemctl',['show',name,'--property=MainPID,ActiveState,SubState,NRestarts,UnitFileState'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean).map(x=>{const i=x.indexOf('=');return[x.slice(0,i),x.slice(i+1)]}));
const descendants=pid=>{let out=[];try{out=cp.execFileSync('pgrep',['-P',String(pid)],{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean)}catch{}return out.flatMap(x=>[x,...descendants(x)])};
const opened=()=>{const s=props('radio-live'),pids=[s.MainPID,...(s.MainPID&&s.MainPID!=='0'?descendants(s.MainPID):[])].filter(x=>x&&x!=='0'),found=[];for(const pid of pids)try{for(const fd of fs.readdirSync('/proc/'+pid+'/fd'))try{const f=fs.readlinkSync('/proc/'+pid+'/fd/'+fd);if(f===p.stageVideo||f===p.audio)found.push({pid,file:f})}catch{} }catch{}return{service:s,radioStream:props('radio-stream'),files:found,overlaySha:hash(p.target),stageListSha:hash(p.stageList),hanbokSha:hash(p.hanbokPath)}};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const before=opened();assert.equal(before.service.ActiveState,'active','재기동 전 radio-live가 active가 아닙니다');assert.equal(before.service.SubState,'running','재기동 전 radio-live가 running이 아닙니다');assert.equal(before.service.UnitFileState,'enabled','radio-live가 enabled가 아닙니다');assert.ok(before.radioStream.ActiveState!=='active','radio-stream이 활성 상태입니다');assert.equal(before.overlaySha,p.overlaySha,'재기동 전 오버레이 지문');assert.equal(before.stageListSha,p.stageListSha,'재기동 전 무대 목록 지문');assert.equal(before.hanbokSha,p.hanbokSha,'보존 한복 파일 지문');assert.ok(before.files.some(x=>x.file===p.stageVideo),'재기동 전 추석 영상 파일을 열지 않았습니다');assert.ok(before.files.some(x=>x.file===p.audio),'재기동 전 기존 오디오 파일을 열지 않았습니다');
 const stoppedAt=new Date().toISOString();cp.execFileSync('sudo',['-n','systemctl','stop','radio-live'],{encoding:'utf8',timeout:30000});await sleep(2000);const stopped=opened();assert.ok(stopped.service.ActiveState!=='active'&&stopped.service.SubState!=='running','radio-live 정지 확인 실패');
 const startedAt=new Date().toISOString();cp.execFileSync('sudo',['-n','systemctl','start','radio-live'],{encoding:'utf8',timeout:30000});let after=null;for(let i=0;i<120;i++){const s=opened();if(s.service.ActiveState==='active'&&s.service.SubState==='running'&&s.files.some(x=>x.file===p.stageVideo)&&s.files.some(x=>x.file===p.audio)){after=s;break}await sleep(1000)}if(!after)throw Error('radio-live가 정지 후 추석 영상·기존 오디오를 연 상태로 복귀하지 않았습니다');assert.equal(after.service.UnitFileState,'enabled','재기동 후 radio-live enabled');assert.equal(after.overlaySha,p.overlaySha,'재기동 후 오버레이 지문');assert.equal(after.stageListSha,p.stageListSha,'재기동 후 무대 목록 지문');assert.equal(after.hanbokSha,p.hanbokSha,'재기동 후 보존 한복 파일 지문');
 console.log(JSON.stringify({at:new Date().toISOString(),stoppedAt,startedAt,before,stopped,after,stopStartConfirmed:true},null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1});`;
const raw=execFileSync('ssh',['-i',path.join(os.homedir(),'.ssh','synk_radio'),'-o','StrictHostKeyChecking=accept-new','-o','ConnectTimeout=20','synk-radio','node'],{input:'globalThis.p='+JSON.stringify(payload)+';\n'+code,encoding:'utf8',timeout:180000,maxBuffer:4*1024*1024,windowsHide:true});
fs.writeFileSync(path.join(dir,'라디오껐다켜기.json'),raw,'utf8');console.log(raw);
