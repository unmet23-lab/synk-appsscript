'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const dir = __dirname;
const root = path.resolve(dir, '..', '..', '..');
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
const mode = process.argv[2] || '--check';
if (!['--check', '--apply'].includes(mode)) throw new Error('모드는 --check 또는 --apply');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const html = fs.readFileSync(path.join(dir, 'after-마스코트.html'));
const asset = fs.readFileSync(path.join(root, manifest.newRemoteAsset.localPath));
if (sha(html) !== manifest.candidate.sha256) throw new Error('마스코트 HTML 후보 지문이 manifest와 다르다.');
if (sha(asset) !== manifest.newRemoteAsset.sha256) throw new Error('마린 한복 후보 지문이 manifest와 다르다.');
if (sha(fs.readFileSync(path.join(root, manifest.stage.localPath))) !== manifest.stage.sha256) throw new Error('추석 영상 지문이 manifest와 다르다.');
if (sha(fs.readFileSync(path.join(root, manifest.stage.listPath))) !== manifest.stage.listSha256) throw new Error('무대 목록 지문이 manifest와 다르다.');

const target = '/opt/synk-radio/지면/bots/오버레이/마스코트.html';
const stageList = '/opt/synk-radio/무대차례/목록.txt';
const assetTarget = manifest.newRemoteAsset.remotePath;
const oldOverlaySha = manifest.remotePrecondition.overlaySha256;
const oldListSha = manifest.remotePrecondition.stageListSha256;
const assetSha = manifest.newRemoteAsset.sha256;
const tag = 'before-chuseok-marine-hanbok-20260917-' + oldOverlaySha.slice(0, 12);
const backupOverlay = `${target}.${tag}`;
const protectedFiles = Object.entries(manifest.protectedRemote).map(([file, expectedSha]) => ({ file, expectedSha }));
const preservedUnused = Object.entries(manifest.preservedUnusedRemote || {}).map(([file, expectedSha]) => ({ file, expectedSha }));
const payload = {
  mode,
  id: crypto.randomUUID(),
  target,
  stageList,
  assetTarget,
  oldOverlaySha,
  oldListSha,
  newOverlaySha: manifest.candidate.sha256,
  newListSha: manifest.stage.listSha256,
  newAssetSha: assetSha,
  html: html.toString('base64'),
  asset: asset.toString('base64'),
  stageVideo: manifest.stage.remotePath,
  audio: '/opt/synk-radio/소리/synk-radio-blok11-20260909-gapless.flac',
  protectedFiles,
  preservedUnused,
  backupOverlay,
};

const code = String.raw`
const fs=require('fs'),cp=require('child_process'),crypto=require('crypto'),assert=require('assert/strict');
const p=globalThis.p;
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const exists=f=>{try{fs.accessSync(f);return true}catch{return false}};
const protect=()=>[...p.protectedFiles,...p.preservedUnused].forEach(f=>assert.ok(exists(f.file),'보호 파일이 없다: '+f.file)||assert.equal(hash(f.file),f.expectedSha,'보호 파일 변경: '+f.file));
const props=name=>Object.fromEntries(cp.execFileSync('systemctl',['show',name,'--property=MainPID,ActiveState,SubState,NRestarts,UnitFileState'],{encoding:'utf8'}).trim().split('\n').filter(Boolean).map(x=>{const i=x.indexOf('=');return[x.slice(0,i),x.slice(i+1)]}));
const descendants=pid=>{let out=[];try{out=cp.execFileSync('pgrep',['-P',String(pid)],{encoding:'utf8'}).trim().split('\n').filter(Boolean)}catch{}return out.flatMap(x=>[x,...descendants(x)])};
const opened=()=>{const s=props('radio-live'),pids=[s.MainPID,...(s.MainPID&&s.MainPID!=='0'?descendants(s.MainPID):[])].filter(x=>x&&x!=='0'),found=[];for(const pid of pids)try{for(const fd of fs.readdirSync('/proc/'+pid+'/fd'))try{const f=fs.readlinkSync('/proc/'+pid+'/fd/'+fd);if(f===p.stageVideo||f===p.audio)found.push({pid,file:f})}catch{} }catch{}return{service:s,radioStream:props('radio-stream'),files:found}};
const exactOld=()=>{assert.equal(hash(p.target),p.oldOverlaySha,'원격 마스코트 HTML이 예상판과 다르다');assert.equal(hash(p.stageList),p.oldListSha,'원격 무대 목록이 예상판과 다르다')};
const newState=()=>({overlaySha:hash(p.target),stageListSha:hash(p.stageList),assetPresent:exists(p.assetTarget),assetSha:exists(p.assetTarget)?hash(p.assetTarget):null});
const checkNewAsset=()=>{const s=newState();if(s.assetPresent)assert.equal(s.assetSha,p.newAssetSha,'새 한복 경로에 예상 밖 파일이 있다');return s};
const backup=()=>{if(exists(p.backupOverlay))assert.equal(hash(p.backupOverlay),p.oldOverlaySha,'기존 오버레이 백업 지문이 다르다');else fs.copyFileSync(p.target,p.backupOverlay);assert.equal(hash(p.backupOverlay),p.oldOverlaySha,'오버레이 백업 지문')};
const atomicWrite=(target,base64,expected)=>{const tmp=target+'.next-'+p.id;const mode=fs.statSync(target).mode&0o777;fs.writeFileSync(tmp,Buffer.from(base64,'base64'));fs.chmodSync(tmp,mode);assert.equal(hash(tmp),expected,'임시 파일 지문: '+target);fs.renameSync(tmp,target);assert.equal(hash(target),expected,'반영 파일 지문: '+target)};
const atomicWriteNew=(target,base64,expected)=>{fs.mkdirSync(require('path').dirname(target),{recursive:true});const tmp=target+'.next-'+p.id;fs.writeFileSync(tmp,Buffer.from(base64,'base64'));assert.equal(hash(tmp),expected,'임시 한복 지문');fs.renameSync(tmp,target);assert.equal(hash(target),expected,'반영 한복 지문')};
const restoreOverlay=()=>{const current=hash(p.target);if(current===p.oldOverlaySha)return;if(current!==p.newOverlaySha)throw Error('예상하지 못한 타 작업 파일이라 복구하지 않는다: '+p.target);assert.equal(hash(p.backupOverlay),p.oldOverlaySha,'복구 백업 지문');const tmp=p.target+'.restore-'+p.id;fs.copyFileSync(p.backupOverlay,tmp);fs.renameSync(tmp,p.target);assert.equal(hash(p.target),p.oldOverlaySha,'복구 후 오버레이 지문')};
const removeNewAsset=()=>{if(!exists(p.assetTarget))return;assert.equal(hash(p.assetTarget),p.newAssetSha,'새 한복 파일이 예상 밖으로 바뀌어 복구하지 않는다');fs.unlinkSync(p.assetTarget)};
const wait=async()=>{for(let i=0;i<120;i++){const s=opened();if(s.service.ActiveState==='active'&&s.service.SubState==='running'&&s.files.some(x=>x.file===p.stageVideo)&&s.files.some(x=>x.file===p.audio))return s;await new Promise(r=>setTimeout(r,1000))}throw Error('radio-live가 추석 영상과 기존 음악 파일을 연 상태로 올라오지 않았다')};
(async()=>{
 const before=opened();
 assert.equal(before.service.UnitFileState,'enabled','radio-live가 enabled가 아니다');
 assert.ok(before.radioStream.ActiveState!=='active','비활성 radio-stream 서비스가 켜져 있다');
 protect(); exactOld(); const beforeAsset=checkNewAsset();
 let applied=false,restarted=false,assetCreated=false,after=before;
 if(p.mode==='--apply'){
   assert.equal(before.service.ActiveState,'active','현재 radio-live가 active가 아니다');
   assert.equal(before.service.SubState,'running','현재 radio-live가 running이 아니다');
   assert.ok(before.files.some(x=>x.file===p.stageVideo),'현재 추석 영상 파일을 열지 않았다');
   assert.ok(before.files.some(x=>x.file===p.audio),'현재 기존 오디오 파일을 열지 않았다');
   backup(); protect(); exactOld();
   try{
     if(!beforeAsset.assetPresent){atomicWriteNew(p.assetTarget,p.asset,p.newAssetSha);assetCreated=true;}
     atomicWrite(p.target,p.html,p.newOverlaySha);
     protect();
     cp.execFileSync('sudo',['-n','systemctl','restart','radio-live'],{encoding:'utf8',timeout:30000}); restarted=true;
     after=await wait();
     protect();
     assert.equal(hash(p.target),p.newOverlaySha,'재시작 뒤 오버레이 지문');
     assert.equal(hash(p.assetTarget),p.newAssetSha,'재시작 뒤 한복 지문');
     applied=true;
   }catch(e){
     try{cp.execFileSync('sudo',['-n','systemctl','stop','radio-live'],{encoding:'utf8',timeout:30000})}catch{}
     try{restoreOverlay();if(assetCreated)removeNewAsset();protect();cp.execFileSync('sudo',['-n','systemctl','restart','radio-live'],{encoding:'utf8',timeout:30000});after=await wait()}catch(re){throw Error('반영 실패 후 복구도 확인하지 못했다: '+e.message+' / '+re.message)}
     throw Error('반영 실패, 기존 오버레이를 복구했다: '+e.message)
   }
 }
 protect();
 const finalState=newState();
 console.log(JSON.stringify({at:new Date().toISOString(),mode:p.mode,before,after,applied,restarted,assetCreated,beforeAsset,finalState,overlayBackup:p.mode==='--apply'?p.backupOverlay:null,protectedUnchanged:p.protectedFiles.length,preservedUnusedUnchanged:p.preservedUnused.length},null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1});
`;
const key = path.join(os.homedir(), '.ssh', 'synk_radio');
const raw = execFileSync('ssh', ['-i', key, '-o', 'StrictHostKeyChecking=no', '-o', 'ConnectTimeout=20', 'synk@34.71.111.97', 'node'], {
  input: 'globalThis.p=' + JSON.stringify(payload) + ';\n' + code,
  encoding: 'utf8', timeout: 240000, maxBuffer: 4 * 1024 * 1024, windowsHide: true,
});
const result = JSON.parse(raw);
const outName = mode === '--apply' ? '라이브반영.json' : '서버검사.json';
fs.writeFileSync(path.join(dir, outName), JSON.stringify(result, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(result, null, 2));
