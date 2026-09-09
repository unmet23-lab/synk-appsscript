'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{createHash}=require('node:crypto'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/_ops/라디오생동_20260909/v2');
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const key=path.join(os.homedir(),'.ssh/synk_radio'),host='synk@34.71.111.97';
const mode=process.argv[2]||'--check';
if(!['--upload','--check','--apply'].includes(mode))throw new Error('mode');
const entries=[
 ['bots/오버레이/겹쳐송출.js','/opt/synk-radio/지면/bots/오버레이/stream-natural-v2.next.js'],
 ['bots/오버레이/송출진척.js','/opt/synk-radio/지면/bots/오버레이/송출진척.js'],
 ['docs/라디오/무대영상/추석_자연생동_20260909_v2.mp4','/opt/synk-radio/무대차례/chuseok-natural-20260909-v2.mp4']
].map(([local,remote])=>({local:path.join(root,local),path:remote}));
if(mode==='--upload')for(const item of entries){console.log('업로드 '+path.basename(item.local));execFileSync('scp',['-i',key,item.local,host+':'+item.path],{stdio:'inherit',timeout:180000});}
const payload={apply:mode==='--apply',files:entries.map(x=>({path:x.path,sha256:sha(x.local)})),
 originalCode:'3aa9eae43e5ec89c854b502b5909aee466636f597782978ded7f1146cc448ec9',
 audio:'/opt/synk-radio/소리/synk-radio-blok11-20260909-gapless.flac',audioSha:'c9295db33abc8609bda2cdbc885dfce563b52cb6cc6a9db49f7ec276bf931f45'};
const remote=String.raw`
const fs=require('fs'),crypto=require('crypto'),cp=require('child_process'),assert=require('assert/strict');
const p=JSON.parse(process.argv[1]),hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const active='/opt/synk-radio/지면/bots/오버레이/겹쳐송출.js',stage='/opt/synk-radio/무대차례/목록.txt',audio='/opt/synk-radio/소리/playlist.txt',tune='/opt/synk-radio/송출/조율.json';
for(const f of p.files)assert.equal(hash(f.path),f.sha256);
assert.equal(hash(p.audio),p.audioSha);assert.ok([p.originalCode,p.files[0].sha256].includes(hash(active)),'별도 서버 코드 변경 감지');
cp.execFileSync('node',['--check',p.files[0].path]);cp.execFileSync('node',['--check',p.files[1].path]);
const config=JSON.parse(fs.readFileSync(tune,'utf8'));assert.equal(config.무대목록,stage);assert.equal(config.소리목록,audio);
const stageLines=fs.readFileSync(stage,'utf8').trim().split(/\r?\n/);assert.equal(stageLines.length,21);
assert.ok(stageLines.slice(1).every(x=>x==="file 'chuseok-natural-20260909.mp4'"||x==="file 'chuseok-natural-20260909-v2.mp4'"));
const backups=[active,stage,audio,tune].map(x=>x+'.before-natural-v2-20260909');
if(p.apply){
 [active,stage,audio,tune].forEach((x,i)=>{if(!fs.existsSync(backups[i]))fs.copyFileSync(x,backups[i]);});
 const replace=(f,data)=>{fs.writeFileSync(f+'.v2-next',data);fs.renameSync(f+'.v2-next',f);};
 replace(active,fs.readFileSync(p.files[0].path));
 replace(audio,"ffconcat version 1.0\nfile 'synk-radio-blok11-20260909-gapless.flac'\nduration 1701.192199546\n");
 replace(stage,'ffconcat version 1.0\n'+Array(20).fill("file 'chuseok-natural-20260909-v2.mp4'").join('\n')+'\n');
 config.연속소리=true;replace(tune,JSON.stringify(config,null,2)+'\n');
 cp.execFileSync('sudo',['-n','systemctl','restart','radio-live']);
}
console.log(JSON.stringify({applied:p.apply,at:new Date().toISOString(),files:p.files,audioFile:p.audio,audioSha256:p.audioSha,backups,
 activeCodeSha256:hash(active),config:JSON.parse(fs.readFileSync(tune,'utf8')),
 service:cp.execFileSync('systemctl',['show','radio-live','--property=MainPID,ActiveState,ActiveEnterTimestamp,NRestarts'],{encoding:'utf8'}).trim()},null,2));
`;
const data=Buffer.from(JSON.stringify(payload)).toString('base64'),code=Buffer.from(remote).toString('base64');
const command=`node -e 'process.argv[1]=Buffer.from("${data}","base64").toString();eval(Buffer.from("${code}","base64").toString())'`;
const receipt=JSON.parse(execFileSync('ssh',['-i',key,host,command],{encoding:'utf8',timeout:60000}));
if(payload.apply)fs.writeFileSync(path.join(out,'라이브반영.json'),JSON.stringify(receipt,null,2));
console.log(JSON.stringify(receipt,null,2));
