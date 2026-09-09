'use strict';
// 13번에 필요한 3개 설정만 교체한다. 다른 작업의 로컬 지면은 배포하지 않는다.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createHash,randomUUID}=require('node:crypto'),{execFileSync}=require('node:child_process');
const out=path.join(__dirname,'라이브13'),m=JSON.parse(fs.readFileSync(path.join(out,'manifest.json'),'utf8'));
const mode=process.argv[2]||'--check';
if(!['--upload','--check','--apply'].includes(mode))throw Error('모드 오류');
const sha=b=>createHash('sha256').update(b).digest('hex'),hash=f=>sha(fs.readFileSync(f));
const key=path.join(os.homedir(),'.ssh/synk_radio'),host='synk@34.71.111.97',base='/opt/synk-radio/';
function rpc(code,p){return JSON.parse(execFileSync('ssh',['-i',key,host,'node'],{input:'const p='+JSON.stringify(p)+';\n'+code,encoding:'utf8',timeout:60000}));}
const definitions=[
 ['지면/bots/오버레이/마스코트.html',m.sourceHtmlSha],
 ['송출/조율.json','28b153e214d0ee59f498696202f2f8237600ae3630fa998679d07053bb48a4c2'],
 ['무대차례/목록.txt','074f092875f989c75d6fb0e9ed4549554eddb2db0e55fcc8e93dff44bc246db9']
].map(([name,oldSha])=>({name,target:base+name,oldSha}));
const snapshotPath=path.join(out,'배포전원본.json');
if(!fs.existsSync(snapshotPath)){
 const snapshot=rpc("const fs=require('fs'),crypto=require('crypto');console.log(JSON.stringify(p.map(f=>{const b=fs.readFileSync(f.target);if(crypto.createHash('sha256').update(b).digest('hex')!==f.oldSha)throw Error('원본 변경: '+f.target);return {...f,base64:b.toString('base64')};})));",definitions);
 fs.writeFileSync(snapshotPath,JSON.stringify(snapshot,null,2));
}
const snapshots=JSON.parse(fs.readFileSync(snapshotPath,'utf8'));
const contents=snapshots.map((s,i)=>{if(s.target!==definitions[i].target||sha(Buffer.from(s.base64,'base64'))!==definitions[i].oldSha)throw Error('원본 스냅샷 불일치');return Buffer.from(s.base64,'base64').toString('utf8');});
const tuning=JSON.parse(contents[1]);tuning.장면차례='반딧불노을들판';
const newContents=[fs.readFileSync(path.join(out,'after-마스코트.html'),'utf8'),JSON.stringify(tuning,null,2)+'\n','ffconcat version 1.0\n'+Array(80).fill("file '"+m.stageName+"'").join('\n')+'\n'];
if(sha(newContents[0])!==m.htmlSha)throw Error('후보 HTML 변경');
const targets=definitions.map((f,i)=>({...f,newSha:sha(newContents[i]),base64:Buffer.from(newContents[i]).toString('base64'),backup:f.target+'.before-radio13-20260910-'+f.oldSha.slice(0,12)}));
const files=[
 [m.leafName,'지면/docs/라디오/선정무대_20260910/라이브13/'+m.leafName,m.leafSha],
 [m.helperName,'지면/bots/오버레이/'+m.helperName,m.helperSha],
 ['field-radio-720p.mp4','무대차례/'+m.stageName,m.stageSha]
].map(([name,target,expected])=>{const local=path.join(out,name);if(hash(local)!==expected)throw Error('자산 변경: '+name);return {local,target:base+target,sha256:expected};});
const protectedFiles=[
 ['소리/playlist.txt','374e9ce2cc0d6f81928c5639cf69ed0abb9252f2d9f8c2025a24ad330a0bee5c'],
 ['소리/synk-radio-blok11-20260909-gapless.flac','c9295db33abc8609bda2cdbc885dfce563b52cb6cc6a9db49f7ec276bf931f45'],
 ['송출/.env','507d09e16d75f71a2f40821831526895e138046ff4a627b2c92b175134109dfd'],
 ['지면/bots/오버레이/겹쳐송출.js','a1598529a10daac4fb25b7b0dfac3c139b2823198503f6e7723a86d12228f261'],
 ['지면/bots/오버레이/방송층.html','b4a4a0f9e2236bd29cc2ccf116d5d7162aaf390e5f8fea6232051ace5b9466ff'],
 ['지면/bots/오버레이/라디오표정리듬.js','7d583cbb9334358ee4f5676dba9286ec37a3e6f5ad5adeea92d034aa0cc457c8'],
 ['지면/bots/오버레이/송출진척.js','41cbe7c860f66452ef3c2fe89d78210fa2a21f4570558a54e791a7a9b86b6524'],
 ['지면/bots/오버레이/라디오가장자리-b76f448ab55a.js','b76f448ab55af135a5e2dc652683fc721edfc35ceaad7ae1af4bcac138a25a58'],
 ['무대차례/chuseok-tree-light-20260909-dcc5a8fef2e5.mp4','dcc5a8fef2e5efd9c0611166f53fac32846e16fb14f2d81a68a3c6d403ff3dfa']
].map(([name,sha256])=>({path:base+name,sha256}));
const donorFolder='지면/docs/Loom_자산/라디오차림/까몽/_후보/여름델+전설의팻말/65f92a753bb5416b/';
for(const [cut,sha256] of [['본체','eff5870074874ed22d64fef995ed6ef4acf5f9f10711ea895b7e5ea8be3b9713'],['눈감음','7dcfe1f5edafcad44a2fa74b90254ecce153bad59ab7e5b2455804290b24dca9'],['눈웃음','c19871e6eb72a57c9d0a75f8d5d62ef8408a42cb12b81c2ceea10770a408dc2d']])protectedFiles.push({path:base+donorFolder+'여름델+전설의팻말_'+cut+'.webp',sha256});
const p={mode,id:randomUUID(),targets,files,protectedFiles,stage:files[2].target,oldStage:protectedFiles[8].path,audio:protectedFiles[1].path};
const common=String.raw`
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto'),assert=require('assert/strict');
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const protect=()=>p.protectedFiles.forEach(f=>assert.equal(hash(f.path),f.sha256,'보호 파일 변경: '+f.path));
const state=()=>{const hashes=p.targets.map(f=>hash(f.target));if(hashes.every((h,i)=>h===p.targets[i].oldSha))return 'old';if(hashes.every((h,i)=>h===p.targets[i].newSha))return 'new';throw Error('설정 동시 변경 또는 혼합 상태');};
protect();state();
`;
if(mode==='--upload'){
 rpc(common+"for(const f of p.files)fs.mkdirSync(path.dirname(f.target),{recursive:true});console.log('{}');",p);
 for(const f of files)execFileSync('scp',['-i',key,f.local,host+':'+f.target+'.upload-'+p.id],{stdio:'inherit',timeout:60000});
}
const remote=common+String.raw`
(async()=>{
 for(const f of p.files){
  if(p.mode==='--upload'){
   const temp=f.target+'.upload-'+p.id;assert.equal(hash(temp),f.sha256);
   if(fs.existsSync(f.target)){assert.equal(hash(f.target),f.sha256);/* identical retry temp retained */}else fs.renameSync(temp,f.target);
  }
  assert.equal(hash(f.target),f.sha256);
 }
 function status(){
  const service=Object.fromEntries(cp.execFileSync('systemctl',['show','radio-live','--property=MainPID,ActiveState,NRestarts,ActiveEnterTimestamp'],{encoding:'utf8'}).trim().split('\n').map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1)];}));
  const opened=[];let children=[];try{children=cp.execFileSync('pgrep',['-P',service.MainPID],{encoding:'utf8'}).trim().split('\n');}catch{}
  for(const pid of children){try{for(const fd of fs.readdirSync('/proc/'+pid+'/fd')){try{const t=fs.readlinkSync('/proc/'+pid+'/fd/'+fd);if(/\.(mp4|flac)$/.test(t))opened.push(t);}catch{}}}catch{}}
  return {service,opened:[...new Set(opened)]};
 }
 async function awaitMedia(stage){for(let i=0;i<20;i++){const s=status();if(s.service.ActiveState==='active'&&s.opened.includes(stage)&&s.opened.includes(p.audio))return true;await new Promise(r=>setTimeout(r,1000));}return false;}
 const before=status(),initialState=state();let restarted=false;
 if(p.mode==='--apply'&&initialState==='old'){
  for(const f of p.targets){
   if(fs.existsSync(f.backup))assert.equal(hash(f.backup),f.oldSha);else fs.copyFileSync(f.target,f.backup);
   const next=f.target+'.next-'+p.id;fs.writeFileSync(next,Buffer.from(f.base64,'base64'));assert.equal(hash(next),f.newSha);
  }
  protect();assert.equal(state(),'old');
  try{
   for(const f of p.targets){assert.equal(hash(f.target),f.oldSha);fs.renameSync(f.target+'.next-'+p.id,f.target);}
   assert.equal(state(),'new');cp.execFileSync('sudo',['-n','systemctl','restart','radio-live']);restarted=true;
   assert.ok(await awaitMedia(p.stage),'새 배경 및 기존 소리 송출 시작 미확인');protect();
  }catch(e){
   // 이번 배포가 쓴 값만 복원한다. 동시 변경이 있으면 자동 덮어쓰기하지 않는다.
   for(const f of p.targets)assert.ok([f.oldSha,f.newSha].includes(hash(f.target)),'복원 중 동시 변경: '+f.target);
   for(const f of p.targets){assert.equal(hash(f.backup),f.oldSha);const temp=f.target+'.restore-'+p.id;fs.copyFileSync(f.backup,temp);fs.renameSync(temp,f.target);}
   cp.execFileSync('sudo',['-n','systemctl','restart','radio-live']);
   const recovered=await awaitMedia(p.oldStage);throw Error('이전 설정 복원; 이전 방송 재생 확인='+recovered+': '+e.message);
  }
 }
 if(p.mode==='--apply')assert.ok(await awaitMedia(p.stage),'설정은 새 판이나 실제 송출 확인 불가');
 protect();console.log(JSON.stringify({at:new Date().toISOString(),mode:p.mode,applied:state()==='new',restarted,initialState,targets:p.targets.map(f=>({path:f.target,sha256:hash(f.target),backup:f.backup})),files:p.files.map(f=>({path:f.target,sha256:hash(f.target)})),protectedUnchanged:p.protectedFiles.length,before,after:status()}));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
`;
const result=rpc(remote,p);fs.writeFileSync(path.join(out,mode==='--apply'?'라이브반영.json':mode==='--upload'?'업로드검사.json':'서버검사.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
