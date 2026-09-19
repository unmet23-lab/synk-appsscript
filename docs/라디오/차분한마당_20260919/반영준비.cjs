'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const dir=__dirname,root=path.resolve(dir,'../../..'),old=path.resolve(dir,'../세친구_술래잡기_20260919');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const audit=JSON.parse(fs.readFileSync(path.join(dir,'서버현황.json')));
const localAsset='세친구_차분한마당_송출72초.mp4',assetSha256=hash(fs.readFileSync(path.join(dir,localAsset)));
const remoteAsset='/opt/synk-radio/무대차례/calm-courtyard-20260919-'+assetSha256.slice(0,12)+'.mp4';
const oldStage='/opt/synk-radio/무대차례/three-friends-20260919-ad217cb20f67.mp4';
const changes=[];
for(const f of ['방송층.html','전광판판정.js','라디오간판.js']){
 const b=fs.readFileSync(path.join(root,'bots/오버레이',f)),target='/opt/synk-radio/지면/bots/오버레이/'+f,local='after-'+f;
 assert.equal(hash(fs.readFileSync(path.join(dir,'before-'+f))),audit.hashes[target]);
 fs.writeFileSync(path.join(dir,local),b);changes.push({target,local,beforeSha256:audit.hashes[target],afterSha256:hash(b)});
}
const list=Buffer.from("ffconcat version 1.0\nfile '"+path.posix.basename(remoteAsset)+"'\n");
fs.writeFileSync(path.join(dir,'after-목록.txt'),list);changes.push({target:'/opt/synk-radio/무대차례/목록.txt',local:'after-목록.txt',beforeSha256:audit.hashes['/opt/synk-radio/무대차례/목록.txt'],afterSha256:hash(list)});
const protectedFiles=Object.fromEntries(Object.entries(audit.hashes).filter(([k])=>!changes.some(c=>c.target===k)));
protectedFiles[oldStage]='ad217cb20f67ecf9be43681449cb406e26b298f362f312b5d65ef696e26a7516';
const plan={at:new Date().toISOString(),localAsset,assetSha256,remoteAsset,oldStage,audio:'/opt/synk-radio/소리/synk-radio-blok11-20260909-gapless.flac',changes,protected:protectedFiles};
fs.writeFileSync(path.join(dir,'반영계획.json'),JSON.stringify(plan,null,2));
let deploy=fs.readFileSync(path.join(old,'반영.cjs'),'utf8').replaceAll('before-three-friends-20260919-','before-calm-courtyard-20260919-');
deploy=deploy.replace("p.protected[p.oldStage]='c0e984f2ce771cabd1704c5ac25335c1b05519731566de7dfa98cf6622827df7';",'');
fs.writeFileSync(path.join(dir,'반영.cjs'),deploy);
let status=fs.readFileSync(path.join(old,'최종상태.cjs'),'utf8').replaceAll(oldStage,remoteAsset);
fs.writeFileSync(path.join(dir,'최종상태.cjs'),status);
fs.copyFileSync(path.join(old,'수신영상검수.cjs'),path.join(dir,'수신영상검수.cjs'));
fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify({state:'prepared',broadcast:{videoId:'eH0owfx9gCw'},source:{historyId:2823,file:'H3_쉬는마당_원본.mp4'},scene:{loopSeconds:8,archive:'세친구_차분한루프_4K.mp4',native4K:false,broadcastAsset:localAsset,assetSha256,remoteAsset}},null,2));
console.log(JSON.stringify({prepared:true,remoteAsset,files:changes.length}));
