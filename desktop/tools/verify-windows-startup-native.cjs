'use strict';
// Isolated QA only: no --synk-smoke, no gate bypass, no live feed or installer IO.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const args={};for(const arg of process.argv.slice(2)){const match=/^--(build|out|definition|source-hash)=(.+)$/.exec(arg);if(!match)throw Error('Unexpected argument: '+arg);args[match[1]]=match[2];}
if(process.platform!=='win32')throw Error('Windows native host required');
const build=path.resolve(args.build||path.join(__dirname,'windows'));
const out=path.resolve(args.out||path.join(__dirname,'windows-native'));
const archive=path.join(build,'dist/win-unpacked/resources/app.asar');
const executable=path.join(build,'dist/win-unpacked/SYNKPlatformPreview.exe');
const release=JSON.parse(fs.readFileSync(path.join(build,'build-report.json'),'utf8'));
if(!/^[a-f0-9]{64}$/.test(args['source-hash']||''))throw Error('Explicit reviewed --source-hash required');
const expected=JSON.parse(fs.readFileSync(path.resolve(args.definition||path.join(__dirname,'release-definition.draft.json')),'utf8'));
if(!release.ok||release.version!==expected.version||release.buildId!==expected.buildId||release.releaseId!==expected.releaseId||release.artifact.platform!=='win32'||release.sourceHash!==args['source-hash'])throw Error('Expected completed integrated Windows release identity and source hash');
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const before=sha(archive);if(before!==release.artifact.asarSHA256)throw Error('Archive differs from completed build');
if(fs.existsSync(out))throw Error('QA output must be new');
for(const leaf of ['profile/Roaming','profile/Local','profile/Temp','programs'])fs.mkdirSync(path.join(out,leaf),{recursive:true});
const input={out,archive,version:release.version,buildId:release.buildId,appData:path.join(out,'profile/Roaming'),programs:path.join(out,'programs'),prefix:'SYNK_STARTUP_QA '};
function observe(config){
  const {app,shell,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path');
  app.setPath('appData',config.appData);
  const checks=[],errors=[],requests=[],providerRequests=[],opened=[],forbidden=[],pageErrors=[],states=[],screenshots=[];
  let startupWindow,mainWindow,mainCount=0,startupCount=0,feedRequests=0,finished=false,startupReadyResolve,startupReadyReject,quitObserved=false;
  const startupReady=new Promise((resolve,reject)=>{startupReadyResolve=resolve;startupReadyReject=reject;});
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const check=(name,ok,detail)=>{checks.push({name,ok:!!ok,...(detail===undefined?{}:{detail})});if(!ok)throw Error(name);};
  async function waitFor(contents,expression,label,timeout=15000){const end=Date.now()+timeout;while(Date.now()<end){try{if(!contents.isDestroyed()&&await contents.executeJavaScript(expression,true))return;}catch{}await sleep(80);}throw Error('TIMEOUT_'+label);}
  async function capture(window,name){await window.webContents.executeJavaScript('document.fonts.ready.then(()=>true)',true);await sleep(250);const file=path.join(config.out,name+'.png');for(let attempt=0;;attempt++){try{window.webContents.invalidate();await window.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});await sleep(150);fs.writeFileSync(file,(await window.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());break;}catch(error){if(attempt>=2||!String(error.message).includes('UnknownVizError'))throw error;await sleep(150);}}screenshots.push(file);}
  const deny=name=>(...args)=>{forbidden.push({operation:name});throw Error('QA_FORBIDDEN_'+name);};
  // These substitutions are installed before src/main.cjs evaluates any imports.
  require(app.getAppPath()+'/src/program-root.cjs').resolveProgramRoot=()=>config.programs;
  require('node:child_process').spawn=deny('child_process.spawn');
  require('node:child_process').exec=deny('child_process.exec');
  require('node:child_process').execFile=deny('child_process.execFile');
  app.setLoginItemSettings=deny('setLoginItemSettings');
  globalThis.fetch=async url=>{providerRequests.push(String(url));throw Error('QA_ACCOUNT_NETWORK_FORBIDDEN');};
  shell.openExternal=async url=>{opened.push({kind:'external',url});};
  shell.openPath=async()=>{forbidden.push({operation:'shell.openPath'});return 'QA_INSTALLER_OPEN_FORBIDDEN';};
  const updates=require(app.getAppPath()+'/src/platform-update.cjs'),original=updates.createPlatformUpdater;
  const runtime=JSON.parse(fs.readFileSync(app.getAppPath()+'/runtime.json','utf8'));
  check('candidate runtime identity',runtime.update.buildId===config.buildId&&runtime.update.releaseId==='platform-preview-'+config.version);
  updates.createPlatformUpdater=options=>original({...options,request:async url=>{
    check('updater requests only the fixed manifest URL',url===updates.MANIFEST_URL);
    feedRequests++;
    if(feedRequests===1){await startupReady;check('main remains absent while startup check is pending',mainCount===0);}
    else await sleep(220);
    const manifest={schemaVersion:1,product:'platform',channel:'preview',version:config.version,releaseId:runtime.update.releaseId,buildId:config.buildId,publishedAt:new Date().toISOString(),artifacts:[{platform:'win32',arch:'x64',url:'https://github.com/unmet23-lab/synk-policy/releases/download/'+runtime.update.releaseId+'/qa-never-downloaded.exe',bytes:1,sha256:'a'.repeat(64),asarSHA256:'b'.repeat(64)}]};
    return {status:200,headers:{},body:require('node:stream').Readable.from([Buffer.from(JSON.stringify(manifest))])};
  },onChange:value=>{states.push(value.state);options.onChange?.(value);}});
  function blockNetwork(contents){contents.session.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(details,callback)=>{requests.push({url:details.url,method:details.method,resourceType:details.resourceType});callback({cancel:true});});contents.on('console-message',event=>{if(event.level==='error')pageErrors.push({message:event.message.slice(0,400),source:event.sourceId.split('?')[0],line:event.lineNumber});});}
  app.on('will-quit',()=>{quitObserved=true;process.stdout.write('SYNK_STARTUP_QA_QUIT '+JSON.stringify({normalQuit:true,mainCount,startupCount})+'\n');});
  globalThis.__synkNativeQAQuit=()=>app.quit();
  async function finish(ok){
    if(finished)return;finished=true;clearTimeout(deadline);
    const result={ok:ok&&!errors.length&&!pageErrors.length&&!requests.length&&!providerRequests.length&&!forbidden.length,checkedAt:new Date().toISOString(),packaged:app.isPackaged,platform:process.platform,arch:process.arch,version:app.getVersion(),buildId:runtime.update.buildId,profileIsolated:app.getPath('userData').startsWith(config.appData+path.sep),visible:BrowserWindow.getAllWindows().some(window=>window.isVisible()),mainCount,startupCount,feedRequests,states,checks,errors,pageErrors,requests,providerRequests,forbidden,openRequestsSuppressed:opened,screenshots,realAuthenticationPerformed:false,realInstallerOpened:false,realProfileTouched:false,syntheticCurrentFeed:true};
    fs.writeFileSync(path.join(config.out,'native-result.json'),JSON.stringify(result,null,2)+'\n');
    process.stdout.write(config.prefix+JSON.stringify(result)+'\n');
    setTimeout(()=>app.quit(),100);
  }
  const deadline=setTimeout(()=>{errors.push('QA internal deadline');void finish(false);},65000);
  // Record startup failures before Electron can block on its native error box.
  process.on('uncaughtException',error=>{errors.push('MAIN_STARTUP_EXCEPTION: '+(error.stack||error.message));void finish(false);});
  process.on('unhandledRejection',error=>{errors.push('MAIN_STARTUP_REJECTION: '+(error?.stack||error));void finish(false);});
  app.on('browser-window-created',(_event,created)=>{
    created.show=()=>{};created.showInactive=()=>{};created.focus=()=>{};
    const contents=created.webContents;contents.setBackgroundThrottling(false);contents.setAudioMuted(true);blockNetwork(contents);
    // Windows exposes preloadURL rather than preload in early preferences.
    // Classify only after the exact production document has finished loading.
    contents.once('did-finish-load',()=>{
    if(contents.getURL()==='synk-desktop://platform/startup-update.html'){
      startupWindow=created;startupCount++;
      (async()=>{try{
        await waitFor(contents,"document.documentElement.dataset.startupReady==='true'",'startup-renderer');
        const state=await contents.executeJavaScript("(async()=>({status:await synkStartupUpdate.getStatus(),title:document.title,text:document.body.innerText,desktop:typeof synkDesktop,node:typeof require,keys:Object.keys(synkStartupUpdate)}))()",true);
        check('real startup window is isolated and checking',state.status.state==='checking'&&state.title==='SYNK Platform 업데이트'&&state.text.includes('최신 버전을 확인하고 있어요')&&state.desktop==='undefined'&&state.node==='undefined'&&state.keys.sort().join(',')==='getStatus,install,onChanged,openCurrent,retry',state);
        check('startup window stays hidden in QA',!created.isVisible());
        await capture(created,'startup-checking');startupReadyResolve();
      }catch(error){startupReadyReject(error);errors.push(error.stack||error.message);void finish(false);}})();
      return;
    }
    mainWindow=created;mainCount++;
    (async()=>{try{
      const run=expression=>contents.executeJavaScript(expression,true);
      check('actual packaged Windows candidate',app.isPackaged&&app.getAppPath()===config.archive&&process.platform==='win32'&&process.arch==='x64'&&app.getVersion()===config.version);
      check('profile isolated before main initialization',app.getPath('userData').startsWith(config.appData+path.sep));
      check('production gate reaches current before one main window',startupCount===1&&mainCount===1&&states.join(',')==='checking,current'&&feedRequests===1,{states:states.slice(),feedRequests});
      await waitFor(contents,"location.href==='synk-desktop://platform/index.html'&&document.documentElement.dataset.ready==='true'",'main-renderer');
      await waitFor(contents,"window.synkDesktop.authStatus().then(auth=>auth.status==='signed-out')",'signed-out');
      const state=await run("(async()=>({environment:await synkDesktop.getEnvironment(),auth:await synkDesktop.authStatus(),update:await synkDesktop.updateStatus(),node:typeof require,startup:typeof synkStartupUpdate,methods:['authSignUp','updateStatus','checkForUpdate','downloadUpdate','installUpdate','onUpdateChanged'].every(key=>typeof synkDesktop[key]==='function')}))()");
      check('native environment and fixed update bridges',state.environment.clientId==='platform'&&state.environment.nativeShell===true&&state.environment.version===config.version&&state.environment.platform==='win32'&&state.environment.arch==='x64'&&state.node==='undefined'&&state.startup==='undefined'&&state.methods);
      check('empty isolated account stays signed out',state.auth.configured===true&&state.auth.signedIn===false);
      check('startup current status reaches manual updater',state.update.state==='current'&&state.update.currentVersion===config.version&&state.update.currentBuildId===config.buildId&&state.update.latestVersion===config.version&&state.update.latestBuildId===config.buildId,state.update);
      check('startup window is disposed after gate passes',startupWindow.isDestroyed());
      await run("window.__qaUpdateStates=[];window.__qaUpdateOff=synkDesktop.onUpdateChanged(state=>__qaUpdateStates.push(state.state));true");
      for(const width of [1280,1024]){
        created.setSize(width,800);await sleep(180);
        const buttons=await run("(()=>Object.fromEntries(['account-button','signup-button'].map(id=>{const node=document.getElementById(id),rect=node.getBoundingClientRect();return [id,{text:node.innerText,visible:!node.hidden&&rect.width>0&&rect.height>0&&rect.left>=0&&rect.right<=innerWidth,disabled:node.disabled}]})))()");
        check('login and signup visible at '+width,buttons['account-button'].visible&&buttons['account-button'].text.includes('로그인')&&buttons['signup-button'].visible&&!buttons['signup-button'].disabled&&buttons['signup-button'].text==='회원가입',buttons);
        await capture(created,'platform-home-'+width);
      }
      await run("document.getElementById('signup-button').click()");
      await waitFor(contents,"document.getElementById('account-dialog').open&&!document.getElementById('sign-up').disabled",'signup-dialog');
      check('header signup opens only the fixed URL through native IPC',opened.length===1&&opened[0].kind==='external'&&opened[0].url==='https://synk.im/id/?view=signup');
      await run("document.getElementById('sign-up').click()");
      await waitFor(contents,"!document.getElementById('sign-up').disabled",'dialog-signup-complete');
      check('account dialog signup uses the same fixed URL',opened.length===2&&opened.every(item=>item.kind==='external'&&item.url==='https://synk.im/id/?view=signup'));
      const account=await run("(async()=>({auth:await synkDesktop.authStatus(),help:document.getElementById('signup-help').innerText,signIn:document.getElementById('sign-in').innerText}))()");
      check('signup keeps native session signed out and login separate',account.auth.signedIn===false&&account.help.includes('브라우저에서 가입한 뒤')&&account.signIn==='로그인');
      await capture(created,'platform-signup-dialog');await run("document.getElementById('account-dialog').close()");
      for(const view of ['downloads','settings']){
        await run("document.querySelector('[data-view="+view+"]').click()");
        await waitFor(contents,"document.documentElement.dataset.view==='"+view+"'",view);
        const prefix='platform-update-'+view;
        await run("document.getElementById('"+prefix+"-check').click()");
        await waitFor(contents,"document.getElementById('"+prefix+"').dataset.updateState==='current'&&!document.getElementById('"+prefix+"-check').disabled",view+'-update-current');
        const ui=await run("(()=>({version:document.getElementById('"+prefix+"-version').innerText,status:document.getElementById('"+prefix+"-status').innerText,downloadHidden:document.getElementById('"+prefix+"-download').hidden,installHidden:document.getElementById('"+prefix+"-install').hidden,rootHidden:document.getElementById('"+prefix+"').hidden}))()");
        check(view+' manual update displays the current candidate',!ui.rootHidden&&ui.version==='현재 v'+config.version+' · Preview'&&ui.status.startsWith('최신 Preview 버전입니다.')&&ui.status.includes('사용 중에도')&&ui.downloadHidden&&ui.installHidden,ui);
        await capture(created,'platform-update-'+view);
      }
      const events=await run('window.__qaUpdateOff();window.__qaUpdateStates');
      check('manual checks emit real checking and current events',events.join(',')==='checking,current,checking,current'&&feedRequests===3,{events,feedRequests});
      check('only one main window opened',mainCount===1);
      check('no account, remote assets, child process, or installer operation',requests.length===0&&providerRequests.length===0&&forbidden.length===0);
      check('all native QA windows remained hidden',!BrowserWindow.getAllWindows().some(window=>window.isVisible()));
      await finish(true);
    }catch(error){errors.push(error.stack||error.message);try{await capture(created,'failure');}catch{}await finish(false);}})();
    });
  });
  return {appData:app.getPath('appData'),archive:app.getAppPath(),initializationPaused:true};
}
const env={...process.env,APPDATA:input.appData,LOCALAPPDATA:path.join(out,'profile/Local'),TEMP:path.join(out,'profile/Temp'),TMP:path.join(out,'profile/Temp')};delete env.ELECTRON_RUN_AS_NODE;
const child=spawn(executable,['--inspect-brk=127.0.0.1:0','--log-file='+path.join(out,'electron.log')],{cwd:out,windowsHide:true,env,stdio:['ignore','pipe','pipe']});
let stdout='',stderr='',ws,connected=false,sequence=0,injected=false,error=null,normalQuit=false;const pending=new Map();
const rpc=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
function connect(url){ws=new WebSocket(url);ws.addEventListener('open',async()=>{await rpc('Debugger.enable');await rpc('Runtime.runIfWaitingForDebugger');});ws.addEventListener('message',async event=>{const message=JSON.parse(event.data);if(message.id){const item=pending.get(message.id);if(item){pending.delete(message.id);message.error?item.reject(Error(message.error.message)):item.resolve(message.result);}return;}if(message.method==='Debugger.paused'&&!injected){injected=true;try{const result=await rpc('Debugger.evaluateOnCallFrame',{callFrameId:message.params.callFrames[0].callFrameId,expression:'('+observe.toString()+')('+JSON.stringify(input)+')',returnByValue:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));await rpc('Debugger.resume');}catch(e){error=e.message;try{await rpc('Debugger.evaluateOnCallFrame',{callFrameId:message.params.callFrames[0].callFrameId,expression:'require("electron").app.quit()'});await rpc('Debugger.resume');}catch{}ws.close();}}});}
const watchdog=setTimeout(async()=>{error='Native QA timeout; requested normal quit of owned QA process';try{await rpc('Runtime.evaluate',{expression:'globalThis.__synkNativeQAQuit?.()'});}catch{}ws?.close();},85000);
child.stdout.on('data',data=>{stdout+=data;if(stdout.includes('SYNK_STARTUP_QA_QUIT '))normalQuit=true;if(stdout.includes(input.prefix))ws?.close();});
child.stderr.on('data',data=>{stderr+=data;const match=stderr.match(/Debugger listening on (ws:\/\/127\.0\.0\.1:\d+\/[^\s]+)/);if(match&&!connected){connected=true;connect(match[1]);}});
child.on('error',e=>{error=e.message;});
child.on('close',code=>{clearTimeout(watchdog);ws?.close();let result;try{const line=stdout.split(/\r?\n/).find(line=>line.startsWith(input.prefix));result=JSON.parse(line.slice(input.prefix.length));}catch{}
  const unchanged=sha(archive)===before;
  const report={checkedAt:new Date().toISOString(),ok:code===0&&result?.ok===true&&normalQuit&&!error&&unchanged,code,error,normalQuit,asarSha256:before,packageBytesUnchanged:unchanged,buildSourceHash:release.sourceHash,result,...(!result?.ok?{stderr:stderr.slice(-5000),stdout:stdout.slice(-2000)}:{})};
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({ok:report.ok,passed:result?.checks.filter(check=>check.ok).length,checks:result?.checks.length,normalQuit,error:error||result?.errors,report:path.join(out,'report.json')}));if(!report.ok)process.exitCode=1;
});
