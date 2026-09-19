'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process'),crypto=require('crypto');
const dir=__dirname,p=JSON.parse(fs.readFileSync(path.join(dir,'반영계획.json')));
p.mode=process.argv[2]||'--check';if(!['--check','--apply'].includes(p.mode))throw Error('invalid mode');
p.id=crypto.randomUUID();
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const asset=path.join(dir,p.localAsset);if(hash(fs.readFileSync(asset))!==p.assetSha256)throw Error('local asset hash');
p.changes=p.changes.map(c=>{const b=fs.readFileSync(path.join(dir,c.local));if(hash(b)!==c.afterSha256)throw Error('candidate hash');return{...c,base64:b.toString('base64'),backup:c.target+'.before-calm-courtyard-20260919-'+c.beforeSha256.slice(0,12)}});

const key=path.join(os.homedir(),'.ssh','synk_radio');
const sshArgs=['-i',key,'-o','BatchMode=yes','-o','ConnectTimeout=20','synk@34.71.111.97','node'];
const remote=String.raw`
const fs=require('fs'),cp=require('child_process'),crypto=require('crypto'),assert=require('assert/strict');
const p=globalThis.p;
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const protect=()=>Object.entries(p.protected).forEach(([f,s])=>assert.equal(hash(f),s,'protected file changed: '+f));
const props=n=>Object.fromEntries(cp.execFileSync('systemctl',['show',n,'--property=MainPID,ActiveState,SubState,NRestarts,UnitFileState'],{encoding:'utf8'}).trim().split('\n').map(s=>{const i=s.indexOf('=');return[s.slice(0,i),s.slice(i+1)]}));
const children=pid=>{let a=[];try{a=cp.execFileSync('pgrep',['-P',String(pid)],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim().split('\n').filter(Boolean)}catch{}return a.flatMap(c=>[c,...children(c)])};
const state=()=>{const service=props('radio-live'),opened=[];for(const pid of [service.MainPID,...children(service.MainPID)])try{for(const fd of fs.readdirSync('/proc/'+pid+'/fd'))try{const f=fs.readlinkSync('/proc/'+pid+'/fd/'+fd);if([p.remoteAsset,p.oldStage,p.audio].includes(f))opened.push({pid,file:f})}catch{}}catch{}return{service,radioStream:props('radio-stream'),opened}};
const exactOld=()=>p.changes.forEach(c=>assert.equal(hash(c.target),c.beforeSha256,'remote precondition: '+c.target));
const wait=async(video)=>{for(let i=0;i<45;i++){const s=state();if(s.service.ActiveState==='active'&&s.service.SubState==='running'&&s.opened.some(x=>x.file===video)&&s.opened.some(x=>x.file===p.audio))return s;await new Promise(r=>setTimeout(r,1000))}throw Error('media did not open after restart')};
const atomic=(c,b)=>{const tmp=c.target+'.next-'+p.id;fs.writeFileSync(tmp,b,{mode:fs.statSync(c.target).mode&511});assert.equal(hash(tmp),c.afterSha256);fs.renameSync(tmp,c.target)};
(async()=>{
 protect();exactOld();const before=state();
 assert.equal(before.service.ActiveState,'active');assert.equal(before.service.SubState,'running');assert.equal(before.service.UnitFileState,'enabled');assert.notEqual(before.radioStream.ActiveState,'active');
 assert.ok(before.opened.some(x=>x.file===p.oldStage));assert.ok(before.opened.some(x=>x.file===p.audio));
 let after=before,applied=false;
 if(p.mode==='--apply'){
   assert.equal(hash(p.uploadPath),p.assetSha256,'uploaded video hash');
   if(fs.existsSync(p.remoteAsset))assert.equal(hash(p.remoteAsset),p.assetSha256,'existing target asset hash');else fs.renameSync(p.uploadPath,p.remoteAsset);
   for(const c of p.changes){if(fs.existsSync(c.backup))assert.equal(hash(c.backup),c.beforeSha256);else fs.copyFileSync(c.target,c.backup);assert.equal(hash(c.backup),c.beforeSha256);}
   protect();exactOld();
   try {
     for(const c of p.changes)atomic(c,Buffer.from(c.base64,'base64'));
     protect();cp.execFileSync('sudo',['-n','systemctl','restart','radio-live'],{timeout:30000,stdio:'pipe'});
     after=await wait(p.remoteAsset);protect();p.changes.forEach(c=>assert.equal(hash(c.target),c.afterSha256));
     assert.equal(hash(p.remoteAsset),p.assetSha256);applied=true;
   }catch(e){
     cp.execFileSync('sudo',['-n','systemctl','stop','radio-live'],{timeout:30000,stdio:'pipe'});
     for(const c of p.changes){const now=hash(c.target);if(now===c.beforeSha256)continue;assert.equal(now,c.afterSha256,'concurrent changes prevent restoration');assert.equal(hash(c.backup),c.beforeSha256);const tmp=c.target+'.restore-'+p.id;fs.copyFileSync(c.backup,tmp);fs.renameSync(tmp,c.target);}
     protect();cp.execFileSync('sudo',['-n','systemctl','start','radio-live'],{timeout:30000,stdio:'pipe'});await wait(p.oldStage);throw Error('deployment failed; previous scene restored: '+e.message);
   }
 }
 console.log(JSON.stringify({at:new Date().toISOString(),mode:p.mode,applied,before,after,asset:p.remoteAsset,assetSha256:p.mode==='--apply'?hash(p.remoteAsset):null,changes:p.changes.map(c=>({target:c.target,sha256:hash(c.target),backup:p.mode==='--apply'?c.backup:null})),protectedUnchanged:Object.keys(p.protected)},null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1});
`;
function run(payload){return JSON.parse(cp.execFileSync('ssh',sshArgs,{input:'globalThis.p='+JSON.stringify(payload)+';\n'+remote,encoding:'utf8',timeout:100000,maxBuffer:2*1024*1024,windowsHide:true}));}
// Complete the read-only comparison before uploading or replacing anything.
const checked=run({...p,mode:'--check'});fs.writeFileSync(path.join(dir,'반영전확인.json'),JSON.stringify(checked,null,2));
if(p.mode==='--check'){console.log(JSON.stringify(checked,null,2));process.exit(0);}
p.uploadPath=p.remoteAsset+'.upload-'+p.id;
cp.execFileSync('scp',['-i',key,'-o','BatchMode=yes','-o','ConnectTimeout=20',asset,'synk@34.71.111.97:'+p.uploadPath],{timeout:180000,windowsHide:true,stdio:'pipe'});
const result=run(p);fs.writeFileSync(path.join(dir,'라이브반영.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
