'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),electron=require('electron'),results=[];
const selected=process.argv.find(a=>a.startsWith('--client='))?.slice(9);if(selected&&!['platform','world','messenger'].includes(selected))throw Error('Unknown smoke client');
for(const client of selected?[selected]:['platform','world','messenger']){
  const run=spawnSync(electron,[root,'--synk-dev','--client='+client,'--synk-smoke'],{cwd:root,encoding:'utf8',windowsHide:true,timeout:30000});
  const line=run.stdout?.split(/\r?\n/).find(line=>line.startsWith('SYNK_SMOKE '));const result=line?JSON.parse(line.slice(11)):{ok:false,clientId:client,error:'NO_RESULT'};results.push(result);
}
fs.mkdirSync(path.join(root,'artifacts'),{recursive:true});fs.writeFileSync(path.join(root,'artifacts',selected?selected+'-native-smoke.json':'electron-smoke.json'),JSON.stringify({checkedAt:new Date().toISOString(),visibleWindowsOpened:false,results},null,2)+'\n');
process.stdout.write(JSON.stringify(results.map(r=>({clientId:r.environment?.clientId||r.clientId,ok:r.ok,visible:r.visible,download:r.download,frame:r.frame,secureStorageRoundtrip:r.secureStorageRoundtrip,nativeShell:r.nativeShell})),null,2)+'\n');
if(results.some(r=>!r.ok||r.visible||!r.secureStorageRoundtrip?.encrypted||!r.secureStorageRoundtrip?.restored||!r.secureStorageRoundtrip?.removed||r.environment?.clientId==='world'&&!r.frame?.documentLoaded||r.environment?.clientId==='platform'&&!r.nativeShell?.url))process.exitCode=1;
