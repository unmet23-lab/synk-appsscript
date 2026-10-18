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
const list = fs.readFileSync(path.join(dir, '무대차례.txt'));
if (sha(html) !== manifest.candidate.sha256) throw new Error('마스코트 HTML 후보 지문이 manifest와 다르다.');
if (sha(list) !== manifest.stage.listSha256) throw new Error('무대 목록 후보 지문이 manifest와 다르다.');

const oldOverlaySha = manifest.remotePrecondition.overlaySha256;
const oldListSha = manifest.remotePrecondition.stageListSha256;
const target = '/opt/synk-radio/지면/bots/오버레이/마스코트.html';
const stageList = '/opt/synk-radio/무대차례/목록.txt';
const tag = 'before-chuseok-marine-20260916';
const payload = {
  mode,
  id: crypto.randomUUID(),
  target,
  oldOverlaySha,
  newOverlaySha: manifest.candidate.sha256,
  html: html.toString('base64'),
  stageList,
  oldListSha,
  newListSha: manifest.stage.listSha256,
  list: list.toString('base64'),
  stageVideo: manifest.stage.remotePath,
  audio: '/opt/synk-radio/소리/synk-radio-blok11-20260909-gapless.flac',
  protect: Object.entries(manifest.protectedRemote).map(([file, sha256]) => ({ file, sha256 })),
  backupOverlay: `${target}.${tag}-${oldOverlaySha.slice(0, 12)}`,
  backupList: `${stageList}.${tag}-${oldListSha.slice(0, 12)}`,
};

const code = String.raw`
const fs=require('fs'),cp=require('child_process'),crypto=require('crypto'),assert=require('assert/strict');
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const protect=()=>p.protect.forEach(f=>assert.equal(hash(f.file),f.sha256,'보호 파일 변경: '+f.file));
const parseProps=s=>Object.fromEntries(s.trim().split('\n').filter(Boolean).map(x=>{const i=x.indexOf('=');return[x.slice(0,i),x.slice(i+1)];}));
const service=name=>parseProps(cp.execFileSync('systemctl',['show',name,'--property=MainPID,ActiveState,SubState,NRestarts,UnitFileState'],{encoding:'utf8'}));
const descendants=pid=>{let out=[];try{out=cp.execFileSync('pgrep',['-P',String(pid)],{encoding:'utf8'}).trim().split('\n').filter(Boolean);}catch{}return out.flatMap(x=>[x,...descendants(x)]);};
const opened=()=>{const s=service('radio-live'),pids=[s.MainPID,...(s.MainPID&&s.MainPID!=='0'?descendants(s.MainPID):[])].filter(x=>x&&x!=='0'),found=[];for(const pid of pids)try{for(const fd of fs.readdirSync('/proc/'+pid+'/fd'))try{const f=fs.readlinkSync('/proc/'+pid+'/fd/'+fd);if(f===p.stageVideo||f===p.audio)found.push({pid,file:f});}catch{}}catch{}return{service:s,radioStream:service('radio-stream'),files:found};};
const exact=()=>{assert.equal(hash(p.target),p.oldOverlaySha,'원격 마스코트 HTML이 예상판과 다르다');assert.equal(hash(p.stageList),p.oldListSha,'원격 무대 목록이 예상판과 다르다');};
const backup=(target,file,sha)=>{if(fs.existsSync(file))assert.equal(hash(file),sha,'기존 백업이 예상 원본과 다르다: '+file);else fs.copyFileSync(target,file);assert.equal(hash(file),sha,'백업 지문: '+file);};
const atomicWrite=(target,base64,expected)=>{const tmp=target+'.next-'+p.id;const mode=fs.statSync(target).mode&0o777;fs.writeFileSync(tmp,Buffer.from(base64,'base64'));fs.chmodSync(tmp,mode);assert.equal(hash(tmp),expected,'임시 파일 지문');fs.renameSync(tmp,target);assert.equal(hash(target),expected,'반영 파일 지문');};
const restore=(target,backup,oldSha,newSha)=>{const current=hash(target);if(current===oldSha)return;if(current!==newSha)throw Error('예상하지 못한 타 작업 파일이라 복구하지 않는다: '+target);assert.equal(hash(backup),oldSha,'복구 백업 지문');const tmp=target+'.restore-'+p.id;fs.copyFileSync(backup,tmp);fs.renameSync(tmp,target);assert.equal(hash(target),oldSha,'복구 후 지문');};
const wait=async()=>{for(let i=0;i<120;i++){const s=opened();if(s.service.ActiveState==='active'&&s.service.SubState==='running'&&s.files.some(x=>x.file===p.stageVideo)&&s.files.some(x=>x.file===p.audio))return s;await new Promise(r=>setTimeout(r,1000));}throw Error('radio-live가 추석 영상과 기존 음악 파일을 연 상태로 올라오지 않았다');};
(async()=>{
 protect();
 const before=opened();
 assert.equal(before.service.UnitFileState,'enabled','radio-live가 enabled가 아니다');
 assert.ok(before.radioStream.ActiveState!=='active','비활성 radio-stream 서비스가 켜져 있다');
 exact();
 let applied=false,started=false,after=before;
 if(p.mode==='--apply'){
   assert.ok(before.service.ActiveState==='inactive'||before.service.ActiveState==='failed','radio-live가 이미 실행 중이다. 현재 상태를 다시 대조해야 한다.');
   backup(p.target,p.backupOverlay,p.oldOverlaySha);backup(p.stageList,p.backupList,p.oldListSha);protect();exact();
   try{
     atomicWrite(p.stageList,p.list,p.newListSha);
     atomicWrite(p.target,p.html,p.newOverlaySha);
     protect();
     cp.execFileSync('sudo',['-n','systemctl','start','radio-live'],{encoding:'utf8',timeout:30000});started=true;
     after=await wait();protect();
     assert.equal(hash(p.target),p.newOverlaySha);assert.equal(hash(p.stageList),p.newListSha);
     applied=true;
   }catch(e){
     if(started){try{cp.execFileSync('sudo',['-n','systemctl','stop','radio-live'],{encoding:'utf8',timeout:30000});}catch{}}
     restore(p.target,p.backupOverlay,p.oldOverlaySha,p.newOverlaySha);
     restore(p.stageList,p.backupList,p.oldListSha,p.newListSha);
     protect();
     throw Error('반영 또는 시작 실패, 원래 두 파일을 복원했다: '+e.message);
   }
 }
 protect();
 console.log(JSON.stringify({at:new Date().toISOString(),mode: p.mode,before,applied,started,after,overlaySha:hash(p.target),stageListSha:hash(p.stageList),protectedUnchanged:p.protect.length,backups:p.mode==='--apply'?[p.backupOverlay,p.backupList]:[]},null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
`;

const key = path.join(os.homedir(), '.ssh', 'synk_radio');
const raw = execFileSync('ssh', ['-i', key, '-o', 'StrictHostKeyChecking=accept-new', '-o', 'ConnectTimeout=20', 'synk-radio', 'node'], {
  input: 'const p=' + JSON.stringify(payload) + ';\n' + code,
  encoding: 'utf8', timeout: 180000, maxBuffer: 4 * 1024 * 1024, windowsHide: true,
});
const result = JSON.parse(raw);
const outName = mode === '--apply' ? '라이브반영.json' : '서버검사.json';
fs.writeFileSync(path.join(dir, outName), JSON.stringify(result, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(result, null, 2));
