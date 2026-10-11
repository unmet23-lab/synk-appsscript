'use strict';
// Explicit frozen package only. The installed application and its profiles are
// never consulted. A debugger hook isolates AppData before application startup.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process'),asar=require('@electron/asar');
const args=Object.fromEntries(process.argv.slice(2).map(value=>{const m=/^--(candidate|out|mode|require-guest-link)=(.+)$/.exec(value);if(!m)throw Error('Unexpected argument');return [m[1],m[2]];}));
if(!args.candidate||!args.out||!['online','offline'].includes(args.mode))throw Error('Use --candidate=dir --out=dir --mode=online|offline');
const root=path.resolve(__dirname,'../..'),candidate=path.resolve(args.candidate),out=path.resolve(args.out);
for(const value of [candidate,out]){const relative=path.relative(root,value);if(!relative.startsWith('.tmp'+path.sep))throw Error('Candidate and output must be inside workspace .tmp');}
if(fs.existsSync(out)&&fs.readdirSync(out).length)throw Error('Use a new empty output directory');
fs.mkdirSync(out,{recursive:true});
const archive=path.join(candidate,'resources/app.asar'),runtime=JSON.parse(asar.extractFile(archive,'runtime.json'));
if(runtime.clientId!=='world'||runtime.worldCloudPreview!==true||runtime.entry!=='https://synk.im/world/')throw Error('Frozen WORLD cloud candidate required');
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),before=hash(archive),isolation=path.join(out,'isolated');
for(const name of ['Roaming','Local','Temp'])fs.mkdirSync(path.join(isolation,name),{recursive:true});
const config={appData:path.join(isolation,'Roaming'),out,archive,entry:runtime.entry,mode:args.mode,requireGuest:args['require-guest-link']==='true',prefix:'SYNK_WORLD_TUTOR_QA '};
function observe(config){
  const {app,shell}=require('electron'),fs=require('node:fs'),path=require('node:path');
  app.setPath('appData',config.appData);
  const requests=[],providerRequests=[],opened=[],checks=[],screenshots=[],errors=[],pageErrors=[];
  globalThis.fetch=async(...args)=>{providerRequests.push(String(args[0]));throw Error('QA_EMPTY_VAULT_MUST_NOT_FETCH');};
  shell.openExternal=async url=>{opened.push(url);};
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  let window,contents,finished=false,networkBlocked=config.mode==='offline';
  const check=(name,ok,detail)=>{checks.push({name,ok:!!ok,...(detail===undefined?{}:{detail})});if(!ok)throw Error(name);};
  const run=code=>contents.executeJavaScript(code,true);
  async function waitFor(code,label,timeout=20000){const start=Date.now();while(Date.now()-start<timeout){try{if(await run(code))return;}catch{}await sleep(100);}throw Error('TIMEOUT_'+label);}
  async function screenshot(name){await run('document.fonts.ready.then(()=>true)');contents.invalidate();await contents.capturePage(undefined,{stayHidden:true});await sleep(300);contents.invalidate();const file=path.join(config.out,name+'.png');fs.writeFileSync(file,(await contents.capturePage(undefined,{stayHidden:true})).toPNG());screenshots.push(file);}
  async function click(selector,expected){await run(`document.querySelector(${JSON.stringify(selector)}).click()`);await waitFor(`location.href===${JSON.stringify(expected)}&&document.readyState==='complete'`,selector);}
  async function finish(ok){if(finished)return;finished=true;const local=requests.filter(r=>{try{const u=new URL(r.url);return ['127.0.0.1','localhost','[::1]'].includes(u.hostname)&&['4280','4191'].includes(u.port);}catch{return false;}});const result={ok:ok&&errors.length===0&&local.length===0&&providerRequests.length===0,mode:config.mode,offlineSimulation:config.mode==='offline'?'initial HTTPS requests canceled; real retry after unblocking':null,packaged:app.isPackaged,archive:app.getAppPath(),visible:window?.isVisible(),profileIsolated:app.getPath('userData').startsWith(config.appData+path.sep),checks,errors,pageErrors,requests,localhostDevelopmentRequests:local,providerRequests,externalOpensSuppressed:opened,screenshots,scope:'Installed binary candidate with a new isolated profile, production static assets and native guest flow; no real account login or authenticated learning proof.',realAuthenticationPerformed:false,realProfileTouched:false,installerExecuted:false,physicalOtherPC:false};process.stdout.write(config.prefix+JSON.stringify(result)+'\n');setTimeout(()=>app.exit(result.ok?0:1),200);}
  app.on('browser-window-created',(_event,created)=>{
    if(window)return;window=created;window.show=()=>{};window.showInactive=()=>{};contents=window.webContents;contents.setBackgroundThrottling(false);contents.setAudioMuted(true);
    contents.session.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(details,callback)=>{const u=new URL(details.url),unsafe=!['GET','HEAD'].includes(details.method)||u.origin!=='https://synk.im'||/\/(?:api|auth|oauth|functions)\//.test(u.pathname);requests.push({url:u.origin+u.pathname,resourceType:details.resourceType,method:details.method,blocked:networkBlocked||unsafe,unsafe});callback({cancel:networkBlocked||unsafe});});
    contents.on('console-message',event=>{if(event.level==='error')pageErrors.push({message:event.message.slice(0,400),source:event.sourceId.split('?')[0],line:event.lineNumber});});
    (async()=>{try{
      check('actual packaged ASAR',app.isPackaged&&app.getAppPath()===config.archive);
      check('isolated profile before main startup',app.getPath('userData').startsWith(config.appData+path.sep));
      check('empty profile hidden window',!window.isVisible());
      if(config.mode==='offline'){
        await waitFor("location.href==='synk-desktop://status/'&&document.readyState==='complete'&&!!document.querySelector('#retry-connection')",'offline-guide');
        const guide=await run("({text:document.body.innerText,retry:document.querySelector('#retry-connection').href})");
        check('offline guide explains internet connection',guide.text.includes('인터넷 연결')&&!guide.text.includes('이 기기의 앱 서비스'));
        check('offline retry points to public tutor home',guide.retry===config.entry);
        check('offline guide rejects account IPC',await run('window.synkDesktop.authStatus().then(()=>false,()=>true)'));
        await screenshot('offline-internet-guide');networkBlocked=false;await click('#retry-connection',config.entry);
      }
      await waitFor(`location.href===${JSON.stringify(config.entry)}&&!!window.__synkHome&&!!window.__synkWorld`,'public-tutor-home',45000);
      const initial=await run('(async()=>{const auth=await window.synkDesktop.authStatus();return {url:location.href,node:typeof require,environment:await window.synkDesktop.getEnvironment(),configured:auth.configured,signedIn:auth.signedIn,unsafe:await window.synkDesktop.launch("../cmd"),accountMode:window.__SYNK_WORLD_CONFIG__?.mode}})()');
      check('public tutor home uses real native environment',initial.environment.clientId==='world'&&initial.environment.version==='0.4.2'&&initial.node==='undefined');
      check('native configured signed-out state and production account mode',initial.configured===true&&initial.signedIn===false&&initial.accountMode==='account');
      check('unsafe launcher rejected',initial.unsafe.code==='UNKNOWN_CLIENT');
      const choiceUrl=config.entry+'?opening=off&tutor=choose';await run(`location.href=${JSON.stringify(choiceUrl)}`);
      await waitFor("!!window.__synkHome&&!!document.querySelector('[data-tutor-id=marin]')",'tutor-choice');
      await run("import('/world/brand-opening/tutor-profiles.mjs').then(module=>{window.__qaProfiles=module;return true;})");
      for(const id of ['marin','kkamong','mongle']){
        if(id!=='marin'){await run("document.querySelector('#settings-open').click();document.querySelector('[data-tutor-open]').click()");await waitFor("!!document.querySelector('[data-tutor-id]')",'change-tutor');}
        await run(`document.querySelector('[data-tutor-id=${id}]').click();document.querySelector('[data-tutor-reaction=success]').click()`);
        const face=await run(`(()=>{const t=__qaProfiles.TUTORS.find(t=>t.id===${JSON.stringify(id)}),el=document.querySelector('.tutor-portrait.large');return {id:el.dataset.character,face:decodeURIComponent(el.querySelector('.tutor-face').src).endsWith('/'+t.images.기쁨),body:decodeURIComponent(el.querySelector('.tutor-body').src).endsWith('/'+t.images.기본)};})()`);
        check(id+' native choice uses approved success face and base',face.id===id&&face.face&&face.body);await screenshot(id+'-choice-success');
        await run("document.querySelector('[data-tutor-action=confirm]').click();document.querySelector('[data-tutor-action=finish]').click()");
        await waitFor(`document.querySelector('.home-tutor-companion')?.dataset.tutor===${JSON.stringify(id)}`,'new-home-companion');
        check(id+' real native home chooses only the guest scope',await run(`__synkHome.tutor().owner==='guest'&&__synkHome.tutor().tutor===${JSON.stringify(id)}&&JSON.parse(localStorage.getItem('synk.world.tutor.v1:guest')).tutor===${JSON.stringify(id)}`));
        check(id+' home portrait loads and gives its own line',await run("[...document.querySelectorAll('.home-tutor-companion img')].every(i=>i.complete&&i.naturalWidth>0)&&document.querySelector('.home-tutor-companion .game-tutor-line').textContent.length>4"));await screenshot(id+'-home');
        await run("document.querySelector('[data-view=play]').click();document.querySelector('[data-game=hangul]').click()");
        await waitFor("!!document.querySelector('[data-world=account-login]')",'real-guest-game-gate');
        check(id+' actual game entry keeps the native login gate',await run("!document.querySelector('.game-frame')&&!!document.querySelector('[data-world=account-login]')"));
        if(id==='mongle')await screenshot('real-game-login-gate');await run("document.querySelector('#panel-close').click()");
      }
      await run("location.href='https://synk.im/try/learning-hub/'");await waitFor("location.pathname==='/try/learning-hub/'&&document.readyState==='complete'",'legacy-hub');
      check('legacy learning hub cannot use native account IPC',await run('window.synkDesktop.authStatus().then(()=>false,()=>true)'));
      const account='https://synk.im/account/client.html?product=world&play=learning-hub';
      await click('a[href="/account/client.html?product=world&play=learning-hub"]',account);
      check('legacy account return retains configured native IPC',await run('window.synkDesktop.authStatus().then(s=>s.configured===true&&s.signedIn===false)'));
      await screenshot('legacy-account-return');
      await run(`location.href=${JSON.stringify(config.entry+'?opening=off')}`);await waitFor("!!window.__synkHome&&!!document.querySelector('.home-tutor-companion')",'back-tutor-home');
      check('return to tutor home preserves the guest choice',await run("__synkHome.tutor().tutor==='mongle'&&document.querySelector('.home-tutor-companion').dataset.tutor==='mongle'"));
      check('no external opens or blocked API requests',opened.length===0&&requests.every(r=>!r.unsafe));
      check('no script CSP or runtime errors',pageErrors.length===0,pageErrors);
      check('no startup auth request with empty vault',providerRequests.length===0);
      check('no dev-server requests',requests.every(r=>!/^https?:\/\/(?:127\.0\.0\.1|localhost):(?:4280|4191)(?:\/|$)/.test(r.url)));
      check('window remained hidden',!window.isVisible());
      await finish(true);
    }catch(error){errors.push(error.stack||error.message);try{await screenshot('failure');checks.push({name:'failure state',ok:false,detail:await run("({url:location.href,runner:window.synkRunner?.info,text:document.body.innerText.slice(0,1400)})")});}catch{}await finish(false);}})();
  });
  return {appData:app.getPath('appData'),archive:app.getAppPath()};
}
const child=spawn(path.join(candidate,'SYNKWorldPreview.exe'),['--inspect-brk=127.0.0.1:0','--log-file='+path.join(out,'electron.log')],{cwd:out,windowsHide:true,env:{...process.env,APPDATA:config.appData,LOCALAPPDATA:path.join(isolation,'Local'),TEMP:path.join(isolation,'Temp'),TMP:path.join(isolation,'Temp')},stdio:['ignore','pipe','pipe']});
let stdout='',stderr='',ws,connected=false,sequence=0,injected=false,error=null;const pending=new Map();
const rpc=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
function connect(url){ws=new WebSocket(url);ws.addEventListener('open',async()=>{await rpc('Debugger.enable');await rpc('Runtime.runIfWaitingForDebugger');});ws.addEventListener('message',async event=>{const message=JSON.parse(event.data);if(message.id){const p=pending.get(message.id);if(p){pending.delete(message.id);message.error?p.reject(Error(message.error.message)):p.resolve(message.result);}return;}if(message.method==='Debugger.paused'&&!injected){injected=true;try{const result=await rpc('Debugger.evaluateOnCallFrame',{callFrameId:message.params.callFrames[0].callFrameId,expression:'('+observe.toString()+')('+JSON.stringify(config)+')',returnByValue:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));await rpc('Debugger.resume');}catch(e){error=e.message;child.kill('SIGKILL');}}});}
const timer=setTimeout(()=>{error='Native QA timeout';child.kill('SIGKILL');},150000);
child.stdout.on('data',data=>{stdout+=data;if(stdout.includes(config.prefix))ws?.close();});child.stderr.on('data',data=>{stderr+=data;const match=stderr.match(/Debugger listening on (ws:\/\/127\.0\.0\.1:\d+\/[^\s]+)/);if(match&&!connected){connected=true;connect(match[1]);}});child.on('error',e=>{error=e.message;});
child.on('close',code=>{clearTimeout(timer);ws?.close();let result;try{result=JSON.parse(stdout.split(/\r?\n/).find(line=>line.startsWith(config.prefix)).slice(config.prefix.length));}catch{}
  const report={checkedAt:new Date().toISOString(),ok:code===0&&result?.ok===true&&!error&&hash(archive)===before,candidate,asarSha256:before,packageBytesUnchanged:hash(archive)===before,code,error,result,source:__filename,...(!result?.ok?{stderr:stderr.slice(-4000),stdout:stdout.slice(-1000)}:{})};
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,report:path.join(out,'report.json'),passed:result?.checks.filter(c=>c.ok).length,checks:result?.checks.length,error:error||result?.errors}));if(!report.ok)process.exitCode=1;
});
