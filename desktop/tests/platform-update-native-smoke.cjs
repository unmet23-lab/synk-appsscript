'use strict';
// Run with the repository's Electron binary. This uses an isolated hidden window,
// synthetic manifest/installer bytes, no network, account, real installer or dialog.
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{Readable}=require('node:stream'),{createHash}=require('node:crypto');
const {createPlatformUpdater,MANIFEST_URL}=require('../src/platform-update.cjs');
const {installDraftExitGuard}=require('../src/draft-exit.cjs');
const output=path.resolve(process.argv.find(value=>value.startsWith('--output='))?.slice(9)||path.join(__dirname,'../../.tmp/platform-update-native-smoke'));
fs.mkdirSync(output,{recursive:true});app.setPath('userData',path.join(output,'profile'));app.setName('SYNK Synthetic Update Lifecycle');
let window,updater,answer=0,quits=0,launched=0,prompts=0,done=false;const phases=[];
const timer=setTimeout(()=>finish(new Error('Synthetic update lifecycle timed out')),15000);
function finish(error){if(done)return;done=true;clearTimeout(timer);const result={ok:!error,phases,prompts,quits,launched,...(error?{error:error.stack}:{})};fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(result,null,2));process.stdout.write(JSON.stringify(result)+'\n');app.exit(error?1:0);}
app.on('window-all-closed',()=>{});
app.on('will-quit',event=>{
  quits++;phases.push('will-quit-'+quits);
  if(updater.needsInstallHandoff()){
    event.preventDefault();
    void updater.completeInstall().then(result=>{assert.equal(result.ok,true);assert.equal(launched,1);assert.equal(window.isDestroyed(),true);app.quit();}).catch(finish);
  }else{
    assert.equal(quits,2);assert.equal(launched,1);assert.equal(prompts,2);phases.push('normal-final-quit');
    done=true;clearTimeout(timer);fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({ok:true,phases,prompts,quits,launched},null,2));process.stdout.write('SYNK_UPDATE_NATIVE_PASS\n');updater.dispose();
  }
});
app.whenReady().then(async()=>{
  const bytes=Buffer.from('synthetic verified installer'),hash=createHash('sha256').update(bytes).digest('hex');
  const manifest={schemaVersion:1,product:'platform',channel:'preview',version:'0.4.5',buildId:'20261015.1',releaseId:'platform-preview-0.4.5',publishedAt:'2026-10-14T00:00:00.000Z',artifacts:[{platform:'win32',arch:'x64',url:'https://github.com/unmet23-lab/synk-policy/releases/download/platform-preview-0.4.5/synthetic.exe',bytes:bytes.length,sha256:hash,asarSHA256:'a'.repeat(64)}]};
  updater=createPlatformUpdater({enabled:true,config:{manifestUrl:MANIFEST_URL,channel:'preview',releaseId:'platform-preview-0.4.4',buildId:'20261014.1'},currentVersion:'0.4.4',platform:'win32',arch:'x64',cacheRoot:path.join(output,'cache'),now:()=>Date.parse('2026-10-14T12:00:00Z'),
    request:async url=>({status:200,headers:{},body:Readable.from([url===MANIFEST_URL?Buffer.from(JSON.stringify(manifest)):bytes])}),
    requestQuit:()=>setImmediate(()=>app.quit()),openInstaller:async file=>{assert.equal(window.isDestroyed(),true);assert.equal(createHash('sha256').update(fs.readFileSync(file)).digest('hex'),hash);launched++;phases.push('verified-handoff');}});
  window=new BrowserWindow({show:false,width:400,height:300,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
  installDraftExitGuard({window,contents:window.webContents,dialog:{showMessageBoxSync(){prompts++;return answer;}}});
  window.webContents.on('will-prevent-unload',event=>{if(!event.defaultPrevented){updater.cancelInstall();phases.push('draft-kept');}});
  await window.loadURL('data:text/html,<html><body>synthetic update lifecycle</body></html>');
  await window.webContents.executeJavaScript('window.onbeforeunload=()=>false;true');
  await updater.checkForUpdate();await updater.downloadUpdate();await updater.installUpdate();
  await new Promise(resolve=>setTimeout(resolve,150));
  assert.equal(prompts,1);assert.equal(launched,0);assert.equal(quits,0);assert.equal(window.isDestroyed(),false);assert.equal(updater.snapshot().state,'ready');
  phases.push('cancel-preserved-window');answer=1;await updater.installUpdate();
}).catch(finish);
