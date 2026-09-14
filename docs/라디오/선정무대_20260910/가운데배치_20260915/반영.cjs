'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const dir=__dirname,manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8')),mode=process.argv[2]||'--check';
if(!['--check','--apply'].includes(mode))throw Error('모드 오류');
const html=fs.readFileSync(path.join(dir,'after-마스코트.html')),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
if(sha(html)!==manifest.htmlSha)throw Error('가운데 배치 HTML 변경');
const key=path.join(os.homedir(),'.ssh/synk_radio'),host='synk@34.71.111.97';
const rpc=(code,p)=>JSON.parse(execFileSync('ssh',['-i',key,host,'node'],{input:'const p='+JSON.stringify(p)+';\n'+code,encoding:'utf8',timeout:60000,windowsHide:true}));
const p={mode,id:crypto.randomUUID(),target:'/opt/synk-radio/지면/bots/오버레이/마스코트.html',oldSha:manifest.sourceHtmlSha,newSha:manifest.htmlSha,html:html.toString('base64'),backup:'/opt/synk-radio/지면/bots/오버레이/마스코트.html.before-center-20260915-'+manifest.sourceHtmlSha.slice(0,12),stage:'/opt/synk-radio/무대차례/field-radio13-20260910-986177a55b4b.mp4',audio:'/opt/synk-radio/소리/synk-radio-blok11-20260909-gapless.flac',protected:[
 ['/opt/synk-radio/지면/bots/오버레이/'+manifest.helperName,manifest.helperSha],
 ['/opt/synk-radio/지면/docs/라디오/선정무대_20260910/정수리수정/'+manifest.leafName,manifest.leafSha],
 ['/opt/synk-radio/무대차례/field-radio13-20260910-986177a55b4b.mp4',manifest.stageSha],
 ['/opt/synk-radio/소리/synk-radio-blok11-20260909-gapless.flac',manifest.audioSha],
 ['/opt/synk-radio/소리/playlist.txt','374e9ce2cc0d6f81928c5639cf69ed0abb9252f2d9f8c2025a24ad330a0bee5c'],
 ['/opt/synk-radio/무대차례/목록.txt','19552c7713584218a93a1e72b7b8f20f57d034ad453ea3394159d8176c9885bc']
].map(([file,sha256])=>({file,sha256}))};
const code=String.raw`
const fs=require('fs'),cp=require('child_process'),crypto=require('crypto'),assert=require('assert/strict');
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const protect=()=>p.protected.forEach(f=>assert.equal(hash(f.file),f.sha256,'보호 파일 변경: '+f.file));
const state=()=>{const h=hash(p.target);if(h===p.oldSha)return 'old';if(h===p.newSha)return 'new';throw Error('현재 마스코트 HTML이 예상 판과 다르다');};
const service=()=>Object.fromEntries(cp.execFileSync('systemctl',['show','radio-live','--property=MainPID,ActiveState,SubState,NRestarts'],{encoding:'utf8'}).trim().split('\n').map(x=>{const i=x.indexOf('=');return[x.slice(0,i),x.slice(i+1)];}));
const opened=()=>{const s=service(),found=[];let children=[];try{children=cp.execFileSync('pgrep',['-P',s.MainPID],{encoding:'utf8'}).trim().split('\n');}catch{}for(const pid of children)try{for(const fd of fs.readdirSync('/proc/'+pid+'/fd'))try{const f=fs.readlinkSync('/proc/'+pid+'/fd/'+fd);if(f===p.stage||f===p.audio)found.push(f);}catch{}}catch{}return{service:s,files:[...new Set(found)]};};
const wait=async()=>{for(let i=0;i<25;i++){const s=opened();if(s.service.ActiveState==='active'&&s.service.SubState==='running'&&s.files.includes(p.stage)&&s.files.includes(p.audio))return s;await new Promise(r=>setTimeout(r,1000));}throw Error('기존 배경과 소리의 실제 재개를 확인하지 못했다');};
(async()=>{protect();const before=opened(),initialState=state();let restarted=false;
if(p.mode==='--apply'&&initialState==='old'){
 if(fs.existsSync(p.backup))assert.equal(hash(p.backup),p.oldSha);else fs.copyFileSync(p.target,p.backup);
 const next=p.target+'.next-'+p.id;fs.writeFileSync(next,Buffer.from(p.html,'base64'));assert.equal(hash(next),p.newSha);protect();assert.equal(state(),'old');
 try{fs.renameSync(next,p.target);assert.equal(state(),'new');cp.execFileSync('sudo',['-n','systemctl','restart','radio-live']);restarted=true;await wait();protect();}
 catch(e){if([p.oldSha,p.newSha].includes(hash(p.target))&&hash(p.backup)===p.oldSha){const restore=p.target+'.restore-'+p.id;fs.copyFileSync(p.backup,restore);fs.renameSync(restore,p.target);cp.execFileSync('sudo',['-n','systemctl','restart','radio-live']);await wait();}throw Error('가운데 배치 반영 실패, 이전 판 복원: '+e.message);}
}
if(p.mode==='--apply')await wait();protect();console.log(JSON.stringify({at:new Date().toISOString(),mode:p.mode,initialState,applied:state()==='new',restarted,before,after:opened(),targetSha:hash(p.target),protectedUnchanged:p.protected.length,backup:p.backup}));})().catch(e=>{console.error(e.message);process.exitCode=1;});
`;
const result=rpc(code,p),name=mode==='--apply'?'라이브반영.json':'서버검사.json';
fs.writeFileSync(path.join(dir,name),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
