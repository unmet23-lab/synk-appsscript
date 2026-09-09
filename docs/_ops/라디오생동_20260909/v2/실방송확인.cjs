'use strict';
// 이번 반영의 유한 검수. 방송 주소나 원문 로그는 저장하지 않는다.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
const remote=String.raw`
const fs=require('fs'),cp=require('child_process');
const run=(cmd,args)=>cp.execFileSync(cmd,args,{encoding:'utf8'}).trim();
const service=Object.fromEntries(run('systemctl',['show','radio-live','--property=MainPID,ActiveState,ActiveEnterTimestamp,NRestarts']).split('\n').map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1)];}));
const logs=run('journalctl',['-u','radio-live','--since','2026-09-09 10:50:13 UTC','--no-pager','-o','short-iso']);
const progress=logs.split('\n').filter(x=>x.includes('방송시각 ')).map(x=>({at:x.slice(0,25),speed:(x.match(/실시간대비 ([\d.]+x)/)||[])[1],outTime:(x.match(/방송시각 ([\d:.]+)/)||[])[1],drop:(x.match(/버린장 (\d+)/)||[])[1],dup:(x.match(/겹친장 (\d+)/)||[])[1],captureFailures:(x.match(/실패 (\d+)/)||[])[1]}));
const errorPatterns=['Broken pipe','Non-monoton','Invalid','뜨기 실패','제자리다(','정체 감지'];
const errorCounts=Object.fromEntries(errorPatterns.map(s=>[s,logs.split('\n').filter(x=>x.includes(s)).length]));
const pids=run('pgrep',['-P',service.MainPID]).split('\n');const activeFiles=[];
for(const pid of pids)for(const fd of fs.readdirSync('/proc/'+pid+'/fd')){try{const f=fs.readlinkSync('/proc/'+pid+'/fd/'+fd);if(/\.(flac|mp4)$/.test(f))activeFiles.push(f);}catch{}}
console.log(JSON.stringify({checkedAt:new Date().toISOString(),service,progress,errorCounts,activeFiles},null,2));
`;
const command=`node -e 'eval(Buffer.from("${Buffer.from(remote).toString('base64')}","base64").toString())'`;
const result=JSON.parse(execFileSync('ssh',['-i',path.join(os.homedir(),'.ssh/synk_radio'),'synk@34.71.111.97',command],{encoding:'utf8',timeout:30000}));
fs.writeFileSync(path.join(__dirname,'실방송확인.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
