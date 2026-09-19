'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process');
const code=String.raw`
const fs=require('fs'),cp=require('child_process'),crypto=require('crypto');
const base='/opt/synk-radio';
const hash=p=>fs.existsSync(p)?crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'):null;
const props=n=>Object.fromEntries(cp.execFileSync('systemctl',['show',n,'--property=MainPID,ActiveState,SubState,NRestarts,UnitFileState'],{encoding:'utf8'}).trim().split('\n').map(x=>{const i=x.indexOf('=');return[x.slice(0,i),x.slice(i+1)]}));
const files=['/지면/bots/오버레이/마스코트.html','/지면/bots/오버레이/방송층.html','/지면/bots/오버레이/겹쳐송출.js','/무대차례/목록.txt','/소리/playlist.txt','/소리/synk-radio-blok11-20260909-gapless.flac','/송출/조율.json'];
const cfg=JSON.parse(fs.readFileSync(base+'/송출/조율.json','utf8'));
const tuning=Object.fromEntries(['프레임','뜨기','소리목록','무대목록','장면분','장면차례','연속소리'].filter(k=>k in cfg).map(k=>[k,cfg[k]]));
const list=fs.readFileSync(base+'/무대차례/목록.txt','utf8');
const overlay=fs.readFileSync(base+'/지면/bots/오버레이/마스코트.html','utf8');
const parent=fs.readFileSync(base+'/지면/bots/오버레이/방송층.html','utf8');
const service=props('radio-live');
const descend=p=>{let a=[];try{a=cp.execFileSync('pgrep',['-P',String(p)],{encoding:'utf8'}).trim().split('\n').filter(Boolean)}catch{}return a.flatMap(x=>[x,...descend(x)])};
const opened=[];if(service.MainPID!=='0')for(const p of [service.MainPID,...descend(service.MainPID)])try{for(const f of fs.readdirSync('/proc/'+p+'/fd'))try{const t=fs.readlinkSync('/proc/'+p+'/fd/'+f);if(t.startsWith(base+'/무대차례/')||t.startsWith(base+'/소리/'))opened.push({pid:p,file:t})}catch{}}catch{}
const recent=cp.execFileSync('journalctl',['-u','radio-live','-n','160','--no-pager','-o','cat'],{encoding:'utf8'}).split('\n').filter(x=>/실시간대비|frame=|재시작|장면|fps|무대|조율/.test(x)).map(x=>x.replace(/rtmps?:\/\/\S+/gi,'[stream-address-omitted]').replace(/https?:\/\/\S+/gi,'[url-omitted]')).slice(-12);
console.log(JSON.stringify({at:new Date().toISOString(),service,radioStream:props('radio-stream'),tuning,hashes:Object.fromEntries(files.map(f=>[base+f,hash(base+f)])),stageListEntries:list.trim().split('\n').length,stagePaths:[...new Set(list.trim().split('\n'))],opened,recent,overlay,parent},null,2));`;
const raw=cp.execFileSync('ssh',['-i',path.join(os.homedir(),'.ssh','synk_radio'),'-o','BatchMode=yes','-o','ConnectTimeout=20','synk@34.71.111.97','node'],{input:code,encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024,windowsHide:true});
const result=JSON.parse(raw);
fs.writeFileSync(path.join(__dirname,'서버현황.json'),JSON.stringify({...result,overlay:undefined,parent:undefined},null,2));
fs.writeFileSync(path.join(__dirname,'before-마스코트.html'),result.overlay);
fs.writeFileSync(path.join(__dirname,'before-방송층.html'),result.parent);
delete result.overlay;delete result.parent;console.log(JSON.stringify(result,null,2));
