'use strict';
// Run explicitly selected packaged WORLD/Messenger bytes in isolated AppData.
// Main-inspector QA injection only: isolate paths, suppress this window's show(),
// observe network/CSP/DOM, click the packaged fixed retry link once, and app.quit().
// It neither replaces the runtime/content/recovery modules nor calls auth services.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),artifacts=path.join(root,'artifacts/connection-recovery-20261008');
const options=Object.fromEntries(process.argv.slice(2).map(argument=>{const match=/^--(executable|client|stage|mode|label)=(.+)$/.exec(argument);if(!match)throw Error('Use --executable=<absolute packaged exe> --client=world|messenger --stage=candidate|installed --mode=offline|entry-readonly [--label=after-bridge-fix]');return [match[1],match[2]];}));
const id=options.client,stage=options.stage||'candidate',mode=options.mode||'offline',label=options.label||'',names={world:'SYNKWorldPreview',messenger:'SYNKMessengerPreview'};
if(!['candidate','installed'].includes(stage))throw Error('Stage must be candidate or installed');
if(!['offline','entry-readonly'].includes(mode)||mode==='entry-readonly'&&id!=='messenger')throw Error('Read-only entry check is only for Messenger');
if(!['','after-bridge-fix'].includes(label))throw Error('Unsupported evidence label');
if(!Object.hasOwn(names,id)||!options.executable||!path.isAbsolute(options.executable))throw Error('Explicit packaged executable and WORLD/Messenger client are required');
const exe=fs.realpathSync(options.executable),packageRoot=path.dirname(exe),archive=path.join(packageRoot,'resources/app.asar');
if(path.basename(exe)!==names[id]+'.exe')throw Error('Unexpected client executable');
const asar=require('@electron/asar'),metadata=JSON.parse(fs.readFileSync(path.join(packageRoot,'resources/synk-install.json'),'utf8'));
const runtime=JSON.parse(asar.extractFile(archive,'runtime.json').toString('utf8'));
const expectedEntries={world:'http://127.0.0.1:4280/synk-account/client.html?product=world',messenger:'http://127.0.0.1:4191/?tab=messenger'};
if(metadata.clientId!==id||metadata.mode!=='development'||runtime.clientId!==id||runtime.mode!=='development'||runtime.entry!==expectedEntries[id])throw Error('Unexpected package identity or fixed entry');
for(const filename of ['src/connection-content.cjs','src/connection-recovery.cjs'])asar.extractFile(archive,path.normalize(filename));
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const before={executable:sha(exe),asar:sha(archive)};
const isolation=fs.mkdtempSync(path.join(os.tmpdir(),'synk-pc-'));
for(const directory of ['Roaming','Local','Temp'])fs.mkdirSync(path.join(isolation,directory),{recursive:true});
fs.mkdirSync(artifacts,{recursive:true});
const suffix=mode==='entry-readonly'?'-connected':'',evidenceLabel=label?'-'+label:'',expectedAppData=path.join(isolation,'Roaming'),capture=path.join(artifacts,'package-'+id+'-'+stage+(suffix||'-offline')+evidenceLabel+'.png'),reportPath=path.join(artifacts,'package-'+id+'-'+stage+suffix+evidenceLabel+'.json');
const staticPaths=mode==='entry-readonly'?[...new Set([...fs.readFileSync(path.resolve(root,'../docs/마케팅/온라인마케팅지도/engagement/company/public/index.html'),'utf8').matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(match=>new URL(match[1],runtime.entry)).filter(url=>url.origin===new URL(runtime.entry).origin&&!url.pathname.startsWith('/api/')).map(url=>url.pathname).concat(['/pages.css','/dialogs.css','/inter-semibold.ttf','/mono.ttf','/messenger/assets/marin-smile.webp','/messenger/assets/felt-ui/slab-coral-long.webp','/messenger/assets/felt-ui/slab-cream-long.webp']))]:[];
const prefix='SYNK_CONNECTION_PACKAGE ';
const child=spawn(exe,['--inspect-brk=127.0.0.1:0'],{cwd:packageRoot,env:{...process.env,APPDATA:expectedAppData,LOCALAPPDATA:path.join(isolation,'Local'),TEMP:path.join(isolation,'Temp'),TMP:path.join(isolation,'Temp')},windowsHide:true,stdio:['ignore','pipe','pipe']});
let stdout='',stderr='',connected=false,injected=null,ws,sequence=0,error=null,ending=false;const pending=new Map();
const rpc=(method,params={})=>new Promise((resolve,reject)=>{const requestId=++sequence;pending.set(requestId,{resolve,reject});ws.send(JSON.stringify({id:requestId,method,params}));});
const watchdog=setTimeout(()=>{
  error='Packaged connection QA timed out';
  if(ws?.readyState===WebSocket.OPEN)rpc('Runtime.evaluate',{expression:"globalThis.__synkConnectionQaQuit?.()"}).catch(()=>{});
  setTimeout(()=>{if(child.exitCode===null)child.kill();},5000);
},45000);

function installObservation(configuration){
  const {app}=require('electron'),fs=require('node:fs'),path=require('node:path');
  const state={checks:[],requests:[],blockedRequests:[],responses:[],loadFailures:[],consoleErrors:[],statusLoads:0,showSuppressed:0,done:false};
  const check=(name,ok,details={})=>state.checks.push({name,ok:!!ok,...details});
  const statusURL='synk-desktop://status/';
  globalThis.__synkConnectionQaQuit=()=>app.quit();
  app.setPath('appData',configuration.appData);
  app.commandLine.appendSwitch('force-device-scale-factor','1');
  const summarize=()=>({ok:state.checks.every(item=>item.ok)&&state.blockedRequests.length===0&&state.consoleErrors.length===0,checks:state.checks,requests:state.requests,blockedRequests:state.blockedRequests,responses:state.responses,loadFailures:state.loadFailures,consoleErrors:state.consoleErrors,statusLoads:state.statusLoads,showSuppressed:state.showSuppressed});
  function finish(window,error){
    if(state.done)return;state.done=true;
    if(error)check('observation-completed',false,{error:String(error?.message||error)});
    check('packaged-bytes-running',app.isPackaged&&app.getAppPath()===configuration.archive,{packaged:app.isPackaged,appPath:app.getAppPath()});
    check('new-appdata-only',app.getPath('appData')===configuration.appData&&app.getPath('userData').startsWith(configuration.appData+path.sep),{appData:app.getPath('appData'),userData:app.getPath('userData')});
    check('hidden-qa-window',!window.isVisible(),{visible:window.isVisible()});
    const result=summarize();
    process.stdout.write(configuration.prefix+JSON.stringify(result)+'\n');
    // The parent disconnects its inspector after receiving this result.
    setTimeout(()=>app.quit(),150);
  }
  app.on('browser-window-created',(_event,window)=>{
    window.show=()=>{state.showSuppressed++;};window.showInactive=()=>{state.showSuppressed++;};
    const contents=window.webContents;
    contents.session.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(details,callback)=>{
      if(details.url===configuration.entry&&details.resourceType==='mainFrame'){state.requests.push({url:details.url,resourceType:details.resourceType});callback({cancel:false});}
      else {state.blockedRequests.push({url:details.url,resourceType:details.resourceType});callback({cancel:true});}
    });
    contents.debugger.attach('1.3');
    contents.debugger.on('message',(_event,method,params)=>{
      if(method==='Network.responseReceived'&&params.response.url===statusURL){const headers=params.response.headers;state.responses.push({source:'Chromium Network.responseReceived',url:params.response.url,status:params.response.status,contentSecurityPolicy:headers['Content-Security-Policy']||headers['content-security-policy']||null});}
    });
    contents.debugger.sendCommand('Network.enable').catch(error=>state.consoleErrors.push('CSP observer: '+error.message));
    contents.on('did-fail-load',(_event,errorCode,errorDescription,url,isMainFrame)=>state.loadFailures.push({errorCode,errorDescription,url,isMainFrame}));
    contents.on('console-message',details=>{if(details.level==='error'&&!String(details.message).includes('UNTRUSTED_SENDER'))state.consoleErrors.push(String(details.message));});
    let checking=false;
    contents.on('did-finish-load',async()=>{
      if(contents.getURL()!==statusURL||state.done||checking)return;
      checking=true;state.statusLoads++;
      try{
        const dom=await contents.executeJavaScript(`(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(image=>image.decode().catch(()=>{})));return {url:location.href,title:document.title,h1:document.querySelector('h1')?.textContent,retry:document.getElementById('retry-connection')?.href,text:document.body.innerText,node:typeof require,fonts:[...document.fonts].map(font=>({family:font.family,status:font.status})),images:[...document.images].map(image=>({loaded:image.complete&&image.naturalWidth>0})),overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth)};})()`);
        const csp=state.responses.at(-1)?.contentSecurityPolicy;
        check('status-content-'+state.statusLoads,dom.url===statusURL&&dom.title===configuration.title&&dom.h1==='지금은 연결할 수 없어요'&&dom.retry===configuration.entry&&dom.text.includes('다시 연결')&&dom.text.includes('앱을 닫지 않고'),dom);
        check('actual-response-csp-'+state.statusLoads,typeof csp==='string'&&/(?:^|;)\s*script-src\s+'none'(?:;|$)/.test(csp)&&/(?:^|;)\s*connect-src\s+'none'(?:;|$)/.test(csp),{csp:csp||null});
        if(state.statusLoads===1){
          check('packaged-assets-loaded',dom.fonts.some(font=>font.status==='loaded')&&dom.images.every(image=>image.loaded)&&dom.overflow===0&&dom.node==='undefined');
          // This guarded call must be rejected by assertSender before auth.status is reached.
          const denied=await contents.executeJavaScript("window.synkDesktop.authStatus().then(()=>({rejected:false}),error=>({rejected:true,error:String(error)}))");
          check('status-preload-auth-denied',denied.rejected===true&&denied.error.includes('UNTRUSTED_SENDER'),denied);
          contents.invalidate();await new Promise(resolve=>setTimeout(resolve,140));
          await contents.capturePage(undefined,{stayHidden:true,stayAwake:true});await new Promise(resolve=>setTimeout(resolve,150));
          fs.writeFileSync(configuration.capture,(await contents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
          check('capture-written',fs.statSync(configuration.capture).size>0,{path:configuration.capture});
          checking=false;
          await contents.executeJavaScript("document.getElementById('retry-connection').click()");
        }else{
          check('one-retry-same-offline-page',state.statusLoads===2&&state.requests.length===2&&state.loadFailures.filter(item=>item.isMainFrame&&item.url===configuration.entry&&item.errorCode===-102).length===2,{requests:state.requests.length,statusLoads:state.statusLoads});
          finish(window);
        }
      }catch(error){finish(window,error);}
    });
  });
  return {appData:app.getPath('appData'),packaged:app.isPackaged,appPath:app.getAppPath(),memoryInjection:'Isolated appData, this QA window show suppression, read-only Chromium network/CSP and DOM observation, exact loopback-only network guard, one fixed-link click, guarded denied auth IPC, screenshot and app.quit'};
}
function installReadOnlyObservation(configuration){
  const {app}=require('electron'),fs=require('node:fs'),path=require('node:path');
  const state={checks:[],requests:[],blockedRequests:[],responses:[],consoleErrors:[],done:false,anonymousSession:null};
  const check=(name,ok,details={})=>state.checks.push({name,ok:!!ok,...details});
  const origin=new URL(configuration.entry).origin,staticAllowed=new Set(configuration.staticPaths),sessionIds=new Set();
  app.setPath('appData',configuration.appData);app.commandLine.appendSwitch('force-device-scale-factor','1');globalThis.__synkConnectionQaQuit=()=>app.quit();
  function finish(window,error){
    if(state.done)return;state.done=true;if(error)check('read-only-observation-completed',false,{error:String(error.message||error)});
    check('unchanged-packaged-runtime',app.isPackaged&&app.getAppPath()===configuration.archive);
    check('isolated-hidden-window',app.getPath('appData')===configuration.appData&&app.getPath('userData').startsWith(configuration.appData+path.sep)&&!window.isVisible());
    check('no-disallowed-request',state.blockedRequests.length===0,{blockedRequests:state.blockedRequests});
    process.stdout.write(configuration.prefix+JSON.stringify({ok:state.checks.every(item=>item.ok)&&!state.consoleErrors.length,...state})+'\n');setTimeout(()=>app.quit(),150);
  }
  app.on('browser-window-created',(_event,window)=>{
    window.show=()=>{};window.showInactive=()=>{};const contents=window.webContents;
    contents.session.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(details,callback)=>{
      const url=new URL(details.url),method=details.method,read=['GET','HEAD'].includes(method),entry=details.url===configuration.entry&&details.resourceType==='mainFrame',staticFile=staticAllowed.has(url.pathname)&&!url.pathname.startsWith('/api/'),sessionRead=method==='GET'&&!url.search&&['/api/me','/api/synk-id/status'].includes(url.pathname);
      if(url.origin===origin&&read&&(entry||staticFile||sessionRead)){state.requests.push({path:url.pathname,method,resourceType:details.resourceType});callback({cancel:false});}
      else{state.blockedRequests.push({url:details.url,method,resourceType:details.resourceType});callback({cancel:true});}
    });
    contents.debugger.attach('1.3');
    contents.debugger.on('message',async(_event,method,params)=>{
      if(method==='Network.responseReceived'){
        if(params.response.url===configuration.entry){const headers=params.response.headers;state.responses.push({status:params.response.status,contentSecurityPolicy:headers['Content-Security-Policy']||headers['content-security-policy']||null});}
        if(params.response.url===origin+'/api/me')sessionIds.add(params.requestId);
      }
      if(method==='Network.loadingFinished'&&sessionIds.has(params.requestId)){
        sessionIds.delete(params.requestId);
        try{const body=await contents.debugger.sendCommand('Network.getResponseBody',{requestId:params.requestId}),session=JSON.parse(body.base64Encoded?Buffer.from(body.body,'base64').toString('utf8'):body.body);state.anonymousSession=session.user===null&&!session.csrfToken;if(!state.anonymousSession)finish(window,Error('Not an anonymous session; stopped before screen inspection'));}
        catch(error){finish(window,Error('Anonymous session could not be verified: '+error.message));}
      }
    });
    contents.debugger.sendCommand('Network.enable').catch(error=>finish(window,error));
    contents.on('console-message',details=>{if(details.level==='error')state.consoleErrors.push(String(details.message));});
    let observing=false;
    contents.on('did-finish-load',async()=>{
      if(state.done||observing)return;observing=true;
      try{
        if(contents.getURL()!==configuration.entry)throw Error('Expected the connected entry; received another page');
        for(let attempt=0;attempt<200;attempt++){if(state.done)return;if(state.anonymousSession===true&&await contents.executeJavaScript("!!document.querySelector('#main.auth-layout #auth-form[data-form=auth]')&&!!document.getElementById('synk-id-login')&&document.getElementById('synk-id-login-note')?.textContent!=='연결 상태를 확인하고 있어요.'"))break;if(attempt===199)throw Error('Anonymous login form and SYNK ID entry did not become ready');await new Promise(resolve=>setTimeout(resolve,25));}
        if(state.done)return;check('anonymous-session-only',state.anonymousSession===true);
        const dom=await contents.executeJavaScript(`(async()=>{await document.fonts.ready;const form=document.querySelector('#auth-form'),email=form?.querySelector('[name=email]'),password=form?.querySelector('[name=password][type=password]');return {url:location.href,title:document.title,authLayout:!!document.querySelector('#main.auth-layout'),form:form?.dataset.form,emailEmpty:email?.value.length===0,passwordEmpty:password?.value.length===0,heading:document.querySelector('.auth-form-card h2')?.textContent,submit:form?.querySelector('.auth-submit')?.textContent,synkLogin:!!document.getElementById('synk-id-login'),node:typeof require,overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth)};})()`);
        check('real-login-first-screen',dom.url===configuration.entry&&dom.authLayout&&dom.form==='auth'&&dom.emailEmpty&&dom.passwordEmpty&&dom.heading==='다시 만나 반가워요'&&dom.submit?.includes('로그인')&&dom.synkLogin,dom);
        check('login-layout-and-node-isolation',dom.overflow===0&&dom.node==='undefined');
        const csp=state.responses.at(-1)?.contentSecurityPolicy;
        check('actual-entry-csp',typeof csp==='string'&&csp.includes("default-src 'self'")&&csp.includes("object-src 'none'")&&csp.includes("frame-ancestors 'none'"),{csp:csp||null});
        contents.invalidate();await new Promise(resolve=>setTimeout(resolve,150));await contents.capturePage(undefined,{stayHidden:true,stayAwake:true});await new Promise(resolve=>setTimeout(resolve,150));
        fs.writeFileSync(configuration.capture,(await contents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());check('capture-written',fs.statSync(configuration.capture).size>0,{path:configuration.capture});
        finish(window);
      }catch(error){finish(window,error);}
    });
  });
  return {appData:app.getPath('appData'),packaged:app.isPackaged,appPath:app.getAppPath(),memoryInjection:'Isolated AppData, QA window show suppression, exact-origin GET/HEAD static allowlist and GET-only anonymous session/status guard, Chromium session anonymity/CSP/DOM observation and screenshot, app.quit. No authStatus, login or form interaction.'};
}
function connect(url){
  ws=new WebSocket(url);
  ws.addEventListener('error',()=>{if(!ending){error=error||'Main inspector connection failed';child.kill();}});
  ws.addEventListener('message',async event=>{
    const message=JSON.parse(event.data);
    if(message.id){const operation=pending.get(message.id);if(operation){pending.delete(message.id);message.error?operation.reject(Error(message.error.message)):operation.resolve(message.result);}return;}
    if(message.method==='Debugger.paused'&&!injected){
      try{
        const config={appData:expectedAppData,archive,entry:runtime.entry,capture,prefix,staticPaths,title:(id==='world'?'SYNK WORLD':'SYNK Workspace')+' Preview · 연결 확인'};
        const observer=mode==='entry-readonly'?installReadOnlyObservation:installObservation;
        const result=await rpc('Debugger.evaluateOnCallFrame',{callFrameId:message.params.callFrames[0].callFrameId,expression:'('+observer.toString()+')('+JSON.stringify(config)+')',returnByValue:true});
        if(result.exceptionDetails||result.result?.value?.appData!==expectedAppData)throw Error('Main QA isolation setup failed: '+JSON.stringify(result.exceptionDetails||result.result));
        injected=result.result.value;await rpc('Debugger.resume');
      }catch(e){error=e.message;child.kill();}
    }
  });
  ws.addEventListener('open',async()=>{try{await rpc('Debugger.enable');await rpc('Runtime.runIfWaitingForDebugger');}catch(e){error=e.message;child.kill();}});
}
child.stdout.on('data',data=>{stdout+=data;if(stdout.includes(prefix)&&!ending){ending=true;ws?.close();}});
child.stderr.on('data',data=>{stderr+=data;const match=stderr.match(/Debugger listening on (ws:\/\/127\.0\.0\.1:\d+\/[^\s]+)/);if(match&&!connected){connected=true;connect(match[1]);}});
child.on('error',e=>{error=e.message;});
child.on('close',code=>{
  clearTimeout(watchdog);ws?.close();
  let result=null;const line=stdout.split(/\r?\n/).find(value=>value.startsWith(prefix));try{if(line)result=JSON.parse(line.slice(prefix.length));}catch(e){error=e.message;}
  const after={executable:sha(exe),asar:sha(archive)},unchanged=before.executable===after.executable&&before.asar===after.asar;
  const report={checkedAt:new Date().toISOString(),ok:code===0&&result?.ok===true&&!error&&unchanged,stage,mode,label,clientId:id,executable:exe,archive,metadata,entry:runtime.entry,processExitCode:code,error,profileIsolated:injected?.appData===expectedAppData,inspectorInjection:injected,packageBytesUnchanged:unchanged,sha256:after,result,normalProfileRead:false,serverStarted:false,installerExecuted:false,realAuthenticationPerformed:false,scope:mode==='entry-readonly'?'Actual unchanged installed Messenger with anonymous fresh profile. Exact 4191 origin static GET/HEAD and GET /api/me, /api/synk-id/status only; no credentials, authStatus, login/form interaction, operational API, POST or other origin.':'Actual explicitly selected packaged executable, unchanged ASAR/runtime. Only this spawned process receives documented in-memory QA observation. The two exact configured loopback entry attempts are real and expected to refuse; other network targets are blocked.'};
  if(!report.ok)report.stderr=stderr.slice(-3500);
  if(fs.existsSync(reportPath)){const old=JSON.parse(fs.readFileSync(reportPath,'utf8'));if(!old.ok)fs.copyFileSync(reportPath,path.join(artifacts,'package-'+id+'-'+stage+'-failure-'+Date.now()+'.json'));}
  fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({ok:report.ok,clientId:id,exitCode:code,error,checks:result?.checks?.length,failed:result?.checks?.filter(item=>!item.ok),requests:result?.requests,blockedRequests:result?.blockedRequests,capture,profileIsolated:report.profileIsolated,packageBytesUnchanged:unchanged},null,2));
  // Keep the short, synthetic TEMP profile as failure evidence; never touch real profiles.
  if(!report.ok)process.exitCode=1;
});
