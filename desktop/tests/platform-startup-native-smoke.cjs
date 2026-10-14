'use strict';
// Isolated real Electron lifecycle: synthetic manifest, installer and profile.
// The child waits for normal parent exit; no installed app, account or installer
// is opened or modified. No network and no native confirmation UI are used.
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process'),{Readable}=require('node:stream'),{createHash}=require('node:crypto');
const {createPlatformUpdater,MANIFEST_URL}=require('../src/platform-update.cjs');
const {createStartupUpdateGate}=require('../src/platform-startup-update.cjs');
const {launchWindowsUpdate}=require('../src/platform-update-handoff.cjs');
const {installDraftExitGuard}=require('../src/draft-exit.cjs');
const output=path.resolve(process.argv.find(value=>value.startsWith('--output='))?.slice(9)||path.join(__dirname,'../../.tmp/platform-startup-native-smoke'));
const background=process.argv.includes('--background');
fs.mkdirSync(output,{recursive:true});app.setPath('userData',path.join(output,'synthetic-profile'));app.setName('SYNK Synthetic Startup Update');
let window,updater,gate,answer=0,prompts=0,quits=0,proceeds=0,handshakes=0,completed=false;const phases=[];
const timer=setTimeout(()=>finish(Error('Synthetic startup lifecycle timeout')),20000);
function finish(error){if(completed)return;completed=true;clearTimeout(timer);fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({ok:!error,background,phases,prompts,quits,proceeds,handshakes,error:error?.stack},null,2));if(error)app.exit(1);}
app.on('window-all-closed',()=>{});
app.on('will-quit',event=>{
  quits++;
  if(updater.needsInstallHandoff()){
    event.preventDefault();void updater.completeInstall().then(result=>{assert.equal(result.ok,true);phases.push('ready-handshake-accepted');app.quit();}).catch(finish);
  }else{
    try{assert.equal(quits,2);assert.equal(prompts,2);assert.equal(proceeds,background?0:1);assert.equal(handshakes,1);phases.push('normal-parent-exit');updater.dispose();finish();}catch(error){finish(error);}
  }
});
app.whenReady().then(async()=>{
  const bytes=Buffer.from('synthetic startup installer'),sha=createHash('sha256').update(bytes).digest('hex'),nonce='a'.repeat(64);
  const document={schemaVersion:1,product:'platform',channel:'preview',version:'0.4.5',buildId:'20261015.1',releaseId:'platform-preview-0.4.5',publishedAt:'2026-10-14T00:00:00.000Z',artifacts:[{platform:'win32',arch:'x64',url:'https://github.com/unmet23-lab/synk-policy/releases/download/platform-preview-0.4.5/synthetic.exe',bytes:bytes.length,sha256:sha,asarSHA256:'a'.repeat(64)}]};
  const childScript=path.join(output,'synthetic-wait-parent.cjs');
  fs.writeFileSync(childScript,"const fs=require('node:fs');const pid=Number(process.argv.find(v=>v.startsWith('--wait-pid=')).slice(11));const nonce=process.argv.find(v=>v.startsWith('--handoff-token=')).slice(16);process.stdout.write('SYNK_UPDATE_READY '+nonce+'\\n');let count=0;const timer=setInterval(()=>{try{process.kill(pid,0);}catch{clearInterval(timer);fs.writeFileSync(process.env.SYNK_UPDATE_TEST_RESULT,JSON.stringify({ok:true,parentExited:true}));return;}if(++count>300){clearInterval(timer);process.exitCode=1;}},50);");
  updater=createPlatformUpdater({enabled:true,config:{manifestUrl:MANIFEST_URL,channel:'preview',releaseId:'platform-preview-0.4.4',buildId:'20261014.1'},currentVersion:'0.4.4',platform:'win32',arch:'x64',cacheRoot:path.join(output,'synthetic-cache'),now:()=>Date.parse('2026-10-14T12:00:00Z'),onChange:value=>gate?.observe(value),
    request:async url=>({status:200,headers:{},body:Readable.from([url===MANIFEST_URL?Buffer.from(JSON.stringify(document)):bytes])}),requestQuit:()=>setImmediate(()=>app.quit()),
    openInstaller:async(_file,options)=>{assert.equal(options.automatic,true);assert.equal(window.isDestroyed(),true);await launchWindowsUpdate({file:'synthetic-only',pid:process.pid,automatic:true,nonce,spawn:(_file,args,settings)=>spawn(process.execPath,[childScript,...args],{...settings,env:{...process.env,ELECTRON_RUN_AS_NODE:'1',SYNK_UPDATE_TEST_RESULT:path.join(output,'child-result.json')}})});handshakes++;}});
  window=new BrowserWindow({show:false,width:400,height:300,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
  installDraftExitGuard({window,contents:window.webContents,dialog:{showMessageBoxSync(){prompts++;return answer;}}});
  window.webContents.on('will-prevent-unload',event=>{if(!event.defaultPrevented){updater.cancelInstall();gate?.cancelInstall();phases.push('draft-kept-main-restored');}});
  await window.loadURL('data:text/html,<html><body>synthetic inherited session</body></html>');await window.webContents.executeJavaScript('window.onbeforeunload=()=>false;true');
  const makeGate=()=>createStartupUpdateGate({updater,platform:'win32',proceed:()=>{proceeds++;}});
  if(background){updater.start({check:false});await updater.checkInBackground();phases.push('background-auto-install-requested');}else{gate=makeGate();await gate.start();}
  // Window teardown is asynchronous on Windows; wait for the observable draft
  // decision rather than assuming the OS completes it within a fixed 200 ms.
  await new Promise((resolve,reject)=>{const until=Date.now()+5000;const poll=setInterval(()=>{if(prompts===1&&proceeds===(background?0:1)){clearInterval(poll);resolve();}else if(Date.now()>until){clearInterval(poll);reject(Error('Draft cancellation was not observed'));}},25);});
  assert.equal(prompts,1);assert.equal(proceeds,background?0:1);assert.equal(quits,0);assert.equal(handshakes,0);assert.equal(window.isDestroyed(),false);assert.equal(updater.snapshot().state,'ready');
  if(background){await updater.checkInBackground();await updater.checkInBackground();await new Promise(resolve=>setTimeout(resolve,100));assert.equal(prompts,1);assert.equal(updater.snapshot().automatic,false);phases.push('same-release-ticks-preserved-draft');}
  answer=1;gate=makeGate();await gate.start();
}).catch(finish);
