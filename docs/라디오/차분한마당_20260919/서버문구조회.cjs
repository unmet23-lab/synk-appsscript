'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process');
const code=String.raw`
const fs=require('fs'),cp=require('child_process'),crypto=require('crypto'),base='/opt/synk-radio';
const files=['/지면/bots/오버레이/방송층.html','/지면/bots/오버레이/전광판판정.js','/지면/bots/오버레이/라디오간판.js','/지면/bots/오버레이/방송지킴이.js','/무대차례/목록.txt'];
const texts=Object.fromEntries(files.map(p=>[base+p,fs.readFileSync(base+p,'utf8')]));
const protectedPaths=['/지면/bots/오버레이/마스코트.html','/지면/bots/오버레이/겹쳐송출.js','/지면/bots/오버레이/전광판.html','/소리/playlist.txt','/소리/synk-radio-blok11-20260909-gapless.flac','/송출/조율.json'];
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const services=cp.execFileSync('systemctl',['list-units','--type=service','--all','--no-legend','--plain'],{encoding:'utf8'}).split('\n').filter(s=>/radio/.test(s));
const timers=cp.execFileSync('systemctl',['list-timers','--all','--no-legend','--plain'],{encoding:'utf8'}).split('\n').filter(s=>/radio/.test(s));
console.log(JSON.stringify({at:new Date().toISOString(),texts,hashes:Object.fromEntries(files.concat(protectedPaths).map(f=>[base+f,hash(base+f)])),services,timers}));`;
const result=JSON.parse(cp.execFileSync('ssh',['-i',path.join(os.homedir(),'.ssh/synk_radio'),'-o','BatchMode=yes','-o','ConnectTimeout=20','synk@34.71.111.97','node'],{input:code,encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024,windowsHide:true}));
for(const [f,s] of Object.entries(result.texts))fs.writeFileSync(path.join(__dirname,'before-'+path.posix.basename(f)),s);
delete result.texts;fs.writeFileSync(path.join(__dirname,'서버현황.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
