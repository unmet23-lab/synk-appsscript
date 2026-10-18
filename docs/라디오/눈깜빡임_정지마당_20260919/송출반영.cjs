'use strict';
// Explicit stages: upload/replace while stopped, inspect, then start after local finish review record.
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process'),crypto=require('crypto'),assert=require('assert/strict');
const dir=__dirname,mode=process.argv[2]||'--check';assert.ok(['--check','--stage','--start'].includes(mode));
const p=JSON.parse(fs.readFileSync(path.join(dir,'반영계획.json')));p.mode=mode;p.id=crypto.randomUUID();
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const c of p.changes){const b=fs.readFileSync(path.join(dir,c.local));assert.equal(hash(b),c.afterSha256);c.base64=b.toString('base64');c.backup=c.target+'.before-still-kite-20260919-'+c.beforeSha256.slice(0,12);}
const asset=path.join(dir,p.localAsset);assert.equal(hash(fs.readFileSync(asset)),p.assetSha256);
const key=path.join(os.homedir(),'.ssh/synk_radio');
const remote=String.raw`
const fs=require('fs'),cp=require('child_process'),crypto=require('crypto'),assert=require('assert/strict');const p=globalThis.p;
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const props=n=>Object.fromEntries(cp.execFileSync('systemctl',['show',n,'--property=MainPID,ActiveState,SubState,NRestarts,UnitFileState'],{encoding:'utf8'}).trim().split('\n').map(s=>s.split('=')));
const protect=()=>Object.entries(p.protected).forEach(([f,s])=>assert.equal(hash(f),s,'protected '+f));
const before=props('radio-live');protect();assert.equal(before.MainPID,'0');assert.equal(before.ActiveState,'inactive');assert.equal(before.UnitFileState,'enabled');assert.notEqual(props('radio-stream').ActiveState,'active');
const expected=p.mode==='--start'?'afterSha256':'beforeSha256';for(const c of p.changes)assert.equal(hash(c.target),c[expected],'precondition '+c.target);
(async()=>{
 if(p.mode==='--stage'){
  assert.equal(hash(p.uploadPath),p.assetSha256);if(fs.existsSync(p.remoteAsset))assert.equal(hash(p.remoteAsset),p.assetSha256);else fs.renameSync(p.uploadPath,p.remoteAsset);
  for(const c of p.changes){if(!fs.existsSync(c.backup))fs.copyFileSync(c.target,c.backup);assert.equal(hash(c.backup),c.beforeSha256);}
  try{for(const c of p.changes){const tmp=c.target+'.next-'+p.id;fs.writeFileSync(tmp,Buffer.from(c.base64,'base64'),{mode:fs.statSync(c.target).mode&511});assert.equal(hash(tmp),c.afterSha256);fs.renameSync(tmp,c.target);}protect();}
  catch(e){for(const c of p.changes){if(hash(c.target)===c.afterSha256){const tmp=c.target+'.restore-'+p.id;fs.copyFileSync(c.backup,tmp);fs.renameSync(tmp,c.target);}}throw e;}
  assert.equal(props('radio-live').MainPID,'0');
 }
 let media=[],after=props('radio-live');
 if(p.mode==='--start'){
  assert.equal(hash(p.remoteAsset),p.assetSha256);protect();
  cp.execFileSync('sudo',['-n','systemctl','start','radio-live'],{stdio:'pipe',timeout:30000});
  const children=id=>{try{return cp.execFileSync('pgrep',['-P',String(id)],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim().split('\n').flatMap(x=>[x,...children(x)]);}catch{return[];}};
  for(let i=0;i<45;i++){
   after=props('radio-live');media=[];
   for(const pid of children(after.MainPID))try{for(const fd of fs.readdirSync('/proc/'+pid+'/fd'))try{const f=fs.readlinkSync('/proc/'+pid+'/fd/'+fd);if([p.remoteAsset,p.audio].includes(f))media.push({pid,file:f});}catch{}}catch{}
   if(after.ActiveState==='active'&&media.some(x=>x.file===p.remoteAsset)&&media.some(x=>x.file===p.audio))break;
   await new Promise(r=>setTimeout(r,1000));
  }
  if(!media.some(x=>x.file===p.remoteAsset)||!media.some(x=>x.file===p.audio)){
   cp.execFileSync('sudo',['-n','systemctl','stop','radio-live'],{stdio:'pipe',timeout:30000});throw Error('new media did not start; radio left stopped');
  }
  protect();
 }
 console.log(JSON.stringify({at:new Date().toISOString(),mode:p.mode,before,after,media,remoteAsset:p.remoteAsset,assetSha256:p.mode==='--check'?null:hash(p.remoteAsset),changes:p.changes.map(c=>({target:c.target,sha256:hash(c.target),backup:c.backup})),protectedUnchanged:Object.keys(p.protected)},null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1});`;
function run(data){return JSON.parse(cp.execFileSync('ssh',['-i',key,'-o','BatchMode=yes','-o','ConnectTimeout=20','synk-radio','node'],{input:'globalThis.p='+JSON.stringify(data)+';\n'+remote,encoding:'utf8',timeout:100000,maxBuffer:2*1024*1024,windowsHide:true}));}
if(mode==='--stage'){
 run({...p,mode:'--check'});p.uploadPath=p.remoteAsset+'.upload-'+p.id;
 cp.execFileSync('scp',['-i',key,'-o','BatchMode=yes',asset,'synk-radio:'+p.uploadPath],{stdio:'pipe',timeout:180000,windowsHide:true});
}
if(mode==='--start'){
 const review=JSON.parse(fs.readFileSync(path.join(dir,'마감검수.json')));assert.equal(review.assetSha256,p.assetSha256);assert.equal(review.pass,true);
 const staged=JSON.parse(fs.readFileSync(path.join(dir,'서버적용.json')));assert.equal(staged.assetSha256,p.assetSha256);
}
const result=run(p),name={'--check':'반영전확인.json','--stage':'서버적용.json','--start':'송출재개.json'}[mode];
fs.writeFileSync(path.join(dir,name),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
