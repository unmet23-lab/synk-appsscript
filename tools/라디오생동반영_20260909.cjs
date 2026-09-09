'use strict';
// 이번 라디오의 세 파일/두 재생목록만 교체한다. 다른 작업의 의상 API나 저장소 전체는 배포하지 않는다.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/_ops/라디오생동_20260909');
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const apply=process.argv.includes('--apply');
const files={
 video:{local:path.join(root,'docs/라디오/무대영상/추석_자연생동_20260909.mp4'),remote:'/opt/synk-radio/무대차례/chuseok-natural-20260909.mp4'},
 rhythm:{local:path.join(root,'bots/오버레이/라디오표정리듬.js'),remote:'/opt/synk-radio/지면/bots/오버레이/라디오표정리듬.js'},
 html:{local:path.join(out,'마스코트_배포.html'),remote:'/opt/synk-radio/지면/bots/오버레이/mascot-natural-20260909.next.html'}
};
const payload={apply,files:Object.fromEntries(Object.entries(files).map(([k,v])=>[k,{path:v.remote,sha256:sha(v.local)}])),
 oldHtmlHash:sha(path.join(out,'마스코트_서버이전.html')),
 audioSha256:'3894cbb7499093ce8446030e9b301b9c3d739453615569fd2e16f6f3c7ac4183'};
if(apply){const qa=JSON.parse(fs.readFileSync(path.join(out,'브라우저검증.json')));assert.equal(qa.passed,true,'브라우저 최종 검수가 먼저다');}
const remote=String.raw`
const fs=require('fs'),crypto=require('crypto'),cp=require('child_process'),assert=require('assert/strict');
const input=JSON.parse(process.argv[1]);
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const active='/opt/synk-radio/지면/bots/오버레이/마스코트.html';
const stage='/opt/synk-radio/무대차례/목록.txt',audio='/opt/synk-radio/소리/playlist.txt';
for(const v of Object.values(input.files))assert.equal(hash(v.path),v.sha256);
assert.ok([input.oldHtmlHash,input.files.html.sha256].includes(hash(active)),'다른 작업이 라이브 HTML을 바꿨다');
const next=fs.readFileSync(input.files.html.path,'utf8');
for(const script of next.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))new Function(script[1]);
new Function(fs.readFileSync(input.files.rhythm.path,'utf8'));
assert.equal(hash('/opt/synk-radio/소리/synk-radio-blok11-20260909-air.aac'),input.audioSha256);
assert.equal(fs.readFileSync(audio,'utf8').trim(),"ffconcat version 1.0\nfile 'synk-radio-blok11-20260909-air.aac'");
const original=fs.readFileSync(stage,'utf8');
const lines=original.trim().split(/\r?\n/);assert.equal(lines.length,21);assert.equal(lines[0],'ffconcat version 1.0');
assert.ok(lines.slice(1).every(x=>x==="file '덮개붙임_층_chuseok.mp4'"||x==="file 'chuseok-natural-20260909.mp4'"));
const backups=[active+'.before-natural-20260909',stage+'.before-natural-20260909'];
if(input.apply){
 if(!fs.existsSync(backups[0]))fs.copyFileSync(active,backups[0]);
 if(!fs.existsSync(backups[1]))fs.copyFileSync(stage,backups[1]);
 fs.writeFileSync(active+'.natural-next',next);fs.renameSync(active+'.natural-next',active);
 fs.writeFileSync(stage+'.natural-next','ffconcat version 1.0\n'+Array(20).fill("file 'chuseok-natural-20260909.mp4'").join('\n')+'\n');
 fs.renameSync(stage+'.natural-next',stage);
 cp.execFileSync('sudo',['-n','systemctl','restart','radio-live']);
}
console.log(JSON.stringify({applied:input.apply,at:new Date().toISOString(),files:input.files,backups,
 htmlSha256:hash(active),stagePlaylist:fs.readFileSync(stage,'utf8'),audioPlaylist:fs.readFileSync(audio,'utf8'),
 service:cp.execFileSync('systemctl',['show','radio-live','--property=ActiveState,MainPID,ActiveEnterTimestamp'],{encoding:'utf8'}).trim()},null,2));
`;
// SSH command arguments are one JSON/base64 literal; no stream credentials or shell interpolation.
const encoded=Buffer.from(remote).toString('base64'),data=Buffer.from(JSON.stringify(payload)).toString('base64');
const command=`node -e 'process.argv[1]=Buffer.from("${data}","base64").toString();eval(Buffer.from("${encoded}","base64").toString())'`;
const receipt=JSON.parse(execFileSync('ssh',['-i',path.join(os.homedir(),'.ssh/synk_radio'),'synk@34.71.111.97',command],{encoding:'utf8',timeout:60000}));
if(apply)fs.writeFileSync(path.join(out,'라이브반영.json'),JSON.stringify(receipt,null,2));
console.log(JSON.stringify(receipt,null,2));
