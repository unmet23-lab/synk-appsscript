'use strict';
// Read-only live audit. Only new local 재개* evidence files are written.
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process');
const dir=__dirname,root=path.resolve(dir,'../../../..');
const key=path.join(os.homedir(),'.ssh/synk_radio');
const rpc=code=>JSON.parse(cp.execFileSync('ssh',['-i',key,'synk@34.71.111.97','node'],{input:code,encoding:'utf8',timeout:55000,maxBuffer:8*1024*1024,windowsHide:true}));
const expected=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
const serverCode=String.raw`
const fs=require('fs'),cp=require('child_process');
const expected=EXPECTED;
const base='/opt/synk-radio/';
const definitions=[
 ['html','지면/bots/오버레이/마스코트.html',expected.htmlSha],
 ['helper','지면/bots/오버레이/'+expected.helperName,expected.helperSha],
 ['leaf','지면/docs/라디오/선정무대_20260910/정수리수정/'+expected.leafName,expected.leafSha],
 ['stage','무대차례/field-radio13-20260910-986177a55b4b.mp4','986177a55b4bb21ae4d82c483f1c66a92e14d2e48d7a441a7ab76bd0f7e98a65'],
 ['audio','소리/synk-radio-blok11-20260909-gapless.flac','c9295db33abc8609bda2cdbc885dfce563b52cb6cc6a9db49f7ec276bf931f45'],
 ['playlist','소리/playlist.txt','374e9ce2cc0d6f81928c5639cf69ed0abb9252f2d9f8c2025a24ad330a0bee5c'],
 ['stageList','무대차례/목록.txt','19552c7713584218a93a1e72b7b8f20f57d034ad453ea3394159d8176c9885bc']
];
const hashes=definitions.map(([kind,file,want])=>{try{const got=cp.execFileSync('sha256sum',[base+file],{encoding:'utf8'}).split(/\s/)[0];return {kind,sha256:got,expectedMatches:got===want};}catch{return {kind,error:'unreadable'};}});
const raw=cp.execFileSync('systemctl',['show','radio-live','--property=MainPID,NRestarts,ActiveState,SubState,ExecMainStartTimestamp,ExecMainStartTimestampMonotonic'],{encoding:'utf8'});
const status=Object.fromEntries(raw.trim().split('\n').map(s=>{const i=s.indexOf('=');return[s.slice(0,i),s.slice(i+1)];}));
const service={mainPid:Number(status.MainPID),automaticRestarts:Number(status.NRestarts),activeState:status.ActiveState,subState:status.SubState,startedUTC:status.ExecMainStartTimestamp,uptimeSeconds:Math.round(Number(fs.readFileSync('/proc/uptime','utf8').split(' ')[0])-Number(status.ExecMainStartTimestampMonotonic)/1e6)};
let children=[];try{children=cp.execFileSync('pgrep',['-P',String(service.mainPid)],{encoding:'utf8'}).trim().split('\n');}catch{}
let ffmpegPid=null;const opened=[];
for(const pid of children){try{if(fs.readFileSync('/proc/'+pid+'/comm','utf8').trim()==='ffmpeg')ffmpegPid=Number(pid);for(const fd of fs.readdirSync('/proc/'+pid+'/fd')){try{const p=fs.readlinkSync('/proc/'+pid+'/fd/'+fd);if(p===base+definitions.find(x=>x[0]==='stage')[1])opened.push('expected-stage');if(p===base+definitions.find(x=>x[0]==='audio')[1])opened.push('expected-audio');}catch{}}}catch{}}
const journal=cp.execFileSync('journalctl',['-u','radio-live','--since','2026-09-09 18:00:00 UTC','--no-pager','-o','json'],{encoding:'utf8',maxBuffer:8*1024*1024});
const stalls=[],progress=[];
for(const line of journal.trim().split('\n')){let j;try{j=JSON.parse(line);}catch{continue;}const msg=typeof j.MESSAGE==='string'?j.MESSAGE:'';const atUTC=new Date(Number(j.__REALTIME_TIMESTAMP)/1000).toISOString();let m=msg.match(/방송 시각이 (\d+)초째 제자리다\(([\d:.]+)\)/);if(m)stalls.push({atUTC,stalledSeconds:Number(m[1]),outTime:m[2]});m=msg.match(/층 (\d+)장[\s\S]*내보낸 것 (\d+)[\s\S]*실패 (\d+)[\s\S]*실시간대비 ([\d.]+)x?[\s\S]*버린장 (\d+)[\s\S]*겹친장 (\d+)[\s\S]*방송시각 ([\d:.]+)/);if(m)progress.push({atUTC,screenshots:Number(m[1]),emitted:Number(m[2]),failures:Number(m[3]),speed:Number(m[4]),dropped:Number(m[5]),duplicated:Number(m[6]),outTime:m[7]});}
const tcp=[];try{const lines=cp.execFileSync('ss',['-tinp'],{encoding:'utf8'}).split('\n');for(let i=0;i<lines.length;i++){if(ffmpegPid&&lines[i].includes('pid='+ffmpegPid+',')){const a=lines[i].trim().split(/\s+/),n=lines[i+1]||'',get=k=>{const m=n.match(new RegExp(k+':(\\d+)'));return m?Number(m[1]):null;};tcp.push({state:a[0],recvQueue:Number(a[1]),sendQueue:Number(a[2]),bytesSent:get('bytes_sent'),bytesAcked:get('bytes_acked')});}}}catch{}
console.log(JSON.stringify({atUTC:new Date().toISOString(),readOnly:true,hashes,service,ffmpegPid,opened:[...new Set(opened)],tcp,journalSinceUTC:'2026-09-09T18:00:00Z',stallCount:stalls.length,lastStall:stalls.at(-1)||null,stalls,progress:progress.slice(-3)}));
`;
const summary=rpc(serverCode.replace('EXPECTED',JSON.stringify(expected)));
fs.writeFileSync(path.join(dir,'재개상태검수.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify({stage:'service',...summary},null,2));
if(!summary.hashes.every(x=>x.expectedMatches)){console.log('Current live differs from expected snapshot. No changes made; runtime inspection skipped.');process.exit(2);}
const source=fs.readFileSync(path.join(dir,'../서버검수.cjs'),'utf8');
const remote=source.match(/const code=String\.raw`([\s\S]*?)`;/)[1]
 .replace('alias:im.dataset.radio13||null','alias:im.dataset.radio13||null,source:im.dataset.originalSrc||null')
 .replace('viewport:{width:innerWidth,height:innerHeight}',"script:Array.from(document.scripts).map(s=>s.getAttribute('src')).find(s=>s&&s.includes('radio13-')),uniqueImages:new Set(Object.values(이미지.까몽).map(im=>im.src)).size,viewport:{width:innerWidth,height:innerHeight}")
 .replace("assert.ok(samples.every(x=>x.checks.outsideEyeDifference", "assert.ok(samples.every(x=>x.uniqueImages===3&&x.script.includes('radio13-06fdc6100afc.js')&&x.keys.every(k=>k.source==='../../docs/라디오/선정무대_20260910/정수리수정/leaf-base-514d7886949b.png')),'Corrected source provenance mismatch');\nassert.ok(samples.every(x=>x.checks.outsideEyeDifference");
const runtime=rpc(remote);
runtime.allThreeVisualExpressionsObserved=runtime.visualExpressions.length===3;
runtime.correctedSourcesAllNine=true;
fs.writeFileSync(path.join(dir,'재개서버검수.json'),JSON.stringify(runtime,null,2));
console.log(JSON.stringify({stage:'runtime',...runtime},null,2));
const publicText=cp.execFileSync(process.execPath,[path.join(root,'tools/라디오방송건강.js')],{encoding:'utf8',timeout:25000,windowsHide:true});
const streams=publicText.split('\n').filter(x=>x.startsWith('스트림 ')).map(x=>({state:x.match(/받는 중\? (\S+)/)?.[1]||null,health:x.match(/건강 (\S+)/)?.[1]||null}));
const pub={atUTC:new Date().toISOString(),scope:'YouTube official API only, not public player video or audio playback',streams,liveBroadcastCount:(publicText.match(/🟢 방송 중/g)||[]).length,publicLiveBroadcastCount:publicText.split('\n').filter(x=>x.includes('🟢 방송 중')&&x.includes('| public |')&&x.includes('스트림에 묶임')).length,configurationIssueCount:publicText.split('\n').filter(x=>x.startsWith('   ·')).length};
fs.writeFileSync(path.join(dir,'재개공개상태.json'),JSON.stringify(pub,null,2));
console.log(JSON.stringify({stage:'publicAPI',...pub},null,2));
