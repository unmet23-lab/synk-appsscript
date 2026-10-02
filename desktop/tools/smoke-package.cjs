'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {identity,PLATFORM_ENTRY}=require('../src/catalog.cjs');
const root=path.resolve(__dirname,'..'),c=identity('platform','development');
if(process.platform!=='win32'||process.arch!=='x64')throw Error('This installed-binary check requires a Windows x64 host.');
const executable=path.join(root,'dist','preview','win32','x64','platform','win-unpacked',c.executableName+'.exe');
const run=spawnSync(executable,['--synk-smoke'],{cwd:path.dirname(executable),encoding:'utf8',windowsHide:true,timeout:30000});
const line=run.stdout?.split(/\r?\n/).find(line=>line.startsWith('SYNK_SMOKE ')),result=line?JSON.parse(line.slice(11)):{ok:false,error:'NO_RESULT'};
if(result.capturePath&&fs.existsSync(result.capturePath)){const capture=path.join(root,'artifacts','platform-packaged-hidden-preview.png');fs.copyFileSync(result.capturePath,capture);result.capturePath=capture;}
const ok=run.status===0&&result.ok===true&&result.packaged===true&&result.visible===false&&result.environment?.version===require('../package.json').version&&result.nativeShell?.url===PLATFORM_ENTRY&&result.nativeShell.networkBlocked===true&&result.nativeShell.networkRequests?.length===0&&result.nativeShell.consoleErrors?.length===0&&result.secureStorageRoundtrip?.encrypted&&result.secureStorageRoundtrip?.restored&&result.secureStorageRoundtrip?.removed;
const report={checkedAt:new Date().toISOString(),ok:!!ok,installerExecuted:false,arm64Executed:false,captureVerified:false,captureNote:'Hidden compositor capture may contain the first frame. Use a completed native UI probe or visible-window check for visual verification.',executable,result};
fs.writeFileSync(path.join(root,'artifacts','package-native-smoke.json'),JSON.stringify(report,null,2)+'\n');
process.stdout.write(JSON.stringify({ok:!!ok,version:result.environment?.version,packaged:result.packaged,visible:result.visible,nativeShell:result.nativeShell,capturePath:result.capturePath,error:result.error},null,2)+'\n');
if(!ok)process.exitCode=1;
