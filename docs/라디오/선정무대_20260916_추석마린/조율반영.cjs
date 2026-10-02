'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const dir = __dirname;
const expectedSha = '4abcbb70ab802fdf5659515788f3fce7417a3edb4ff6d63c25ed46b5b450c499';
const file = '/opt/synk-radio/송출/조율.json';
const original = {
  프레임: 15,
  뜨기: 6,
  소리목록: '/opt/synk-radio/소리/playlist.txt',
  무대목록: '/opt/synk-radio/무대차례/목록.txt',
  장면분: 20,
  장면차례: '반딧불노을들판',
  연속소리: true,
};
const adjusted = { ...original, 프레임: 12, 뜨기: 4 };
const candidate = Buffer.from(JSON.stringify(adjusted, null, 2) + '\n');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const backup = `${file}.before-chuseok-marine-20260917-${expectedSha.slice(0, 12)}`;
const p = { file, expectedSha, newSha: sha(candidate), config: candidate.toString('base64'), backup, audio: '/opt/synk-radio/소리/synk-radio-blok11-20260909-gapless.flac', video: '/opt/synk-radio/무대차례/chuseok-natural-20260909-v2.mp4' };
const code = String.raw`
const fs=require('fs'),cp=require('child_process'),crypto=require('crypto'),assert=require('assert/strict');
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const props=n=>Object.fromEntries(cp.execFileSync('systemctl',['show',n,'--property=MainPID,ActiveState,SubState,NRestarts,UnitFileState'],{encoding:'utf8'}).trim().split('\n').map(x=>{const i=x.indexOf('=');return[x.slice(0,i),x.slice(i+1)];}));
const opened=()=>{const s=props('radio-live'),ids=[];const walk=pid=>{try{for(const x of cp.execFileSync('pgrep',['-P',String(pid)],{encoding:'utf8'}).trim().split('\n').filter(Boolean)){ids.push(x);walk(x);}}catch{}};if(s.MainPID&&s.MainPID!=='0')walk(s.MainPID);const files=[];for(const id of ids)try{for(const fd of fs.readdirSync('/proc/'+id+'/fd'))try{const f=fs.readlinkSync('/proc/'+id+'/fd/'+fd);if(f===p.audio||f===p.video)files.push({pid:id,file:f});}catch{}}catch{}return{service:s,files,radioStream:props('radio-stream')};};
(async()=>{const before=opened();assert.equal(before.service.ActiveState,'active','radio-live가 실행 중이 아니다');assert.equal(before.service.SubState,'running');assert.ok(before.radioStream.ActiveState!=='active','radio-stream이 실행 중이다');assert.equal(before.service.UnitFileState,'enabled');assert.equal(hash(p.file),p.expectedSha,'조율 파일이 예상판과 다르다');const old=JSON.parse(fs.readFileSync(p.file,'utf8'));assert.deepEqual(old,p.original,'현재 조율 값이 예상판과 다르다');if(fs.existsSync(p.backup))assert.equal(hash(p.backup),p.expectedSha,'기존 백업 지문이 다르다');else fs.copyFileSync(p.file,p.backup);assert.equal(hash(p.backup),p.expectedSha);const st=fs.statSync(p.file),tmp=p.file+'.next-'+p.expectedSha.slice(0,12);fs.writeFileSync(tmp,Buffer.from(p.config,'base64'));fs.chmodSync(tmp,st.mode&0o777);assert.equal(hash(tmp),p.newSha);try{fs.renameSync(tmp,p.file);assert.equal(hash(p.file),p.newSha);cp.execFileSync('sudo',['-n','systemctl','restart','radio-live'],{encoding:'utf8',timeout:30000});let after;for(let i=0;i<90;i++){after=opened();if(after.service.ActiveState==='active'&&after.service.SubState==='running'&&after.files.some(x=>x.file===p.audio)&&after.files.some(x=>x.file===p.video))break;await new Promise(r=>setTimeout(r,1000));}assert.ok(after.service.ActiveState==='active'&&after.service.SubState==='running'&&after.files.some(x=>x.file===p.audio)&&after.files.some(x=>x.file===p.video),'변경 후 송출 입력을 확인하지 못했다');assert.equal(hash(p.file),p.newSha);assert.deepEqual(JSON.parse(fs.readFileSync(p.file,'utf8')),p.adjusted,'요청한 프레임·갱신율 외 값이 바뀌었다');console.log(JSON.stringify({at:new Date().toISOString(),applied:true,before,after,configSha:hash(p.file),backup:p.backup,changedKeys:['프레임 15→12','뜨기 6→4'],preservedKeys:['소리목록','무대목록','장면분','장면차례','연속소리']},null,2));}catch(e){if(hash(p.file)===p.newSha){const restore=p.file+'.restore-'+p.expectedSha.slice(0,12);fs.copyFileSync(p.backup,restore);fs.renameSync(restore,p.file);cp.execFileSync('sudo',['-n','systemctl','restart','radio-live'],{encoding:'utf8',timeout:30000});}throw new Error('조율 적용 실패, 이전 값 복원: '+e.message);}})().catch(e=>{console.error(e.message);process.exitCode=1;});`;
const raw = execFileSync('ssh', ['-i', path.join(os.homedir(), '.ssh', 'synk_radio'), '-o', 'StrictHostKeyChecking=no', '-o', 'ConnectTimeout=20', 'synk@34.71.111.97', 'node'], {
  input: 'const p=' + JSON.stringify({ ...p, original, adjusted }) + ';\n' + code,
  encoding: 'utf8', timeout: 150000, maxBuffer: 2 * 1024 * 1024, windowsHide: true,
});
const result = JSON.parse(raw);
fs.writeFileSync(path.join(dir, '조율반영.json'), JSON.stringify(result, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(result, null, 2));
