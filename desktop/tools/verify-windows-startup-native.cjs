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
  process.stderr.write('SYNK_QA_TRACE observer-installed\n');
  const {app,shell,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
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
  // 검정 구 얼굴의 검사 실행 길(1단계_구현설계.md 11절). 이 값은 본체 프로세스에 심은 때만 참이 되고 보통 사용자는 켤 수 없다.
  globalThis.__synkNativeQAGuestEntry=true;
  require(app.getAppPath()+'/src/program-root.cjs').resolveProgramRoot=()=>config.programs;
  require('node:child_process').spawn=deny('child_process.spawn');
  require('node:child_process').exec=deny('child_process.exec');
  require('node:child_process').execFile=deny('child_process.execFile');
  app.setLoginItemSettings=deny('setLoginItemSettings');
  globalThis.fetch=async url=>{providerRequests.push(String(url));throw Error('QA_ACCOUNT_NETWORK_FORBIDDEN');};
  shell.openExternal=async url=>{opened.push({kind:'external',url});};
  shell.openPath=async()=>{forbidden.push({operation:'shell.openPath'});return 'QA_INSTALLER_OPEN_FORBIDDEN';};
  const updates=require(app.getAppPath()+'/src/platform-update.cjs'),original=updates.createPlatformUpdater;
  // 첫 피드 답은 시작 창 캡처가 끝난 뒤에 돌려준다. 느린 러너에서 관문의 4초 먼저 열기가 그보다 앞서 앱 창을 열지 않게 이 실행에서만 늘린다(0.4.96 Fable F3)
  const gates=require(app.getAppPath()+'/src/platform-startup-update.cjs'),originalGate=gates.createStartupUpdateGate;
  gates.createStartupUpdateGate=options=>originalGate({...options,earlyOpenMs:60000});
  const runtime=JSON.parse(fs.readFileSync(app.getAppPath()+'/runtime.json','utf8'));
  check('candidate runtime identity',runtime.update.buildId===config.buildId&&runtime.update.releaseId==='platform-preview-'+config.version);
  // The candidate must pin real signing keys and refuse an unsigned feed; the QA feed below is signed by a
  // throwaway key handed only to this isolated updater, never by the publisher's key.
  check('packaged updater pins update signing keys',Array.isArray(updates.UPDATE_SIGNING_KEYS)&&updates.UPDATE_SIGNING_KEYS.length>=1&&updates.trustedSigningKeys(updates.UPDATE_SIGNING_KEYS).length===updates.UPDATE_SIGNING_KEYS.length);
  const qaKey=crypto.generateKeyPairSync('ed25519'),qaSpki=qaKey.publicKey.export({type:'spki',format:'der'});
  const qaKeys=updates.trustedSigningKeys([{keyId:crypto.createHash('sha256').update(qaSpki).digest('hex').slice(0,16),spki:qaSpki.toString('base64')}]);
  const signQa=value=>({...value,signature:{alg:'ed25519',keyId:qaKeys[0].keyId,value:crypto.sign(null,updates.signedManifestPayload(value),qaKey.privateKey).toString('base64')}});
  let unsignedRejected=false;try{updates.verifyManifestSignature({schemaVersion:1});}catch(error){unsignedRejected=error.updateCode==='UPDATE_SIGNATURE_INVALID';}
  check('packaged updater rejects an unsigned feed',unsignedRejected);
  updates.createPlatformUpdater=options=>original({...options,trustedKeys:qaKeys,request:async url=>{
    check('updater requests only the fixed manifest URL',url===updates.MANIFEST_URL);
    feedRequests++;
    if(feedRequests===1){await startupReady;check('main remains absent while startup check is pending',mainCount===0);}
    else await sleep(220);
    const manifest={schemaVersion:1,product:'platform',channel:'preview',version:config.version,releaseId:runtime.update.releaseId,buildId:config.buildId,publishedAt:new Date().toISOString(),artifacts:[{platform:'win32',arch:'x64',url:'https://github.com/unmet23-lab/synk-policy/releases/download/'+runtime.update.releaseId+'/qa-never-downloaded.exe',bytes:1,sha256:'a'.repeat(64),asarSHA256:'b'.repeat(64)}]};
    return {status:200,headers:{},body:require('node:stream').Readable.from([Buffer.from(JSON.stringify(signQa(manifest)))])};
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
  // Surface a packaged startup exception before Electron opens a blocking error dialog.
  process.on('uncaughtException',error=>{errors.push('MAIN_STARTUP_EXCEPTION: '+(error.stack||error.message));void finish(false);});
  process.on('unhandledRejection',error=>{errors.push('MAIN_STARTUP_REJECTION: '+(error?.stack||error));void finish(false);});
  app.on('browser-window-created',(_event,created)=>{process.stderr.write('SYNK_QA_TRACE window-created\n');
    created.show=()=>{};created.showInactive=()=>{};created.focus=()=>{};
    const contents=created.webContents;contents.setBackgroundThrottling(false);contents.setAudioMuted(true);blockNetwork(contents);
    // Windows exposes preloadURL rather than preload in early preferences.
    // Classify only after the exact production document has finished loading.
    contents.once('did-finish-load',()=>{
    if(contents.getURL()==='synk-desktop://platform/startup-update.html'){
      startupWindow=created;startupCount++;
      (async()=>{try{
        await waitFor(contents,"document.documentElement.dataset.startupReady==='true'",'startup-renderer');
        // 1-가 시작 창은 확인하는 동안 구만 보이고 문장 칸은 숨는다(innerText가 비어 있다). 문장은 그 칸의 글로, 구만 보이는 것은 data-ui로 본다(0.4.96 대역 빌드 검사에서 찾음)
        const state=await contents.executeJavaScript("(async()=>({status:await synkStartupUpdate.getStatus(),title:document.title,text:document.body.innerText,say:document.getElementById('startup-say')?.textContent||'',ui:document.getElementById('startup-update')?.dataset.ui||'',desktop:typeof synkDesktop,node:typeof require,keys:Object.keys(synkStartupUpdate)}))()",true);
        check('real startup window is isolated and checking',state.status.state==='checking'&&state.title==='SYNK Platform'&&state.say==='새 판을 확인하고 있습니다.'&&state.ui==='none'&&state.desktop==='undefined'&&state.node==='undefined'&&state.keys.sort().join(',')==='close,getStatus,install,minimize,onChanged,onWindowState,openCurrent,retry,toggleMaximize',state);
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
      // 한 번에 묶여 온 바뀜은 옛 값을 차례로 적고 지금 값을 끝에 한 번만 적는다. 바뀜마다 지금 값을 끼우면 차례가 뒤집혔다(0.4.96 카본 E4)
      // 얼굴의 단계 바뀜을 앱이 뜨자마자 적어 둔다. 느린 러너에서는 검사기가 welcome을 잡기 전에 얼굴이 묻는 화면으로 커진다(0.4.95 첫 빌드 Mac x64, Mac 사본과 같다)
      await waitFor(contents,"(()=>{const p=document.getElementById('portal-entry');if(!p)return false;if(!window.__orbSeen){const seen=window.__orbSeen=[p.dataset.portalState||''];const add=v=>{const s=v||'';if(seen[seen.length-1]!==s)seen.push(s);};new MutationObserver(list=>{for(const r of list)add(r.oldValue);add(p.getAttribute('data-portal-state'));}).observe(p,{attributes:true,attributeOldValue:true,attributeFilter:['data-portal-state']});}return location.href==='synk-desktop://platform/index.html'&&document.documentElement.dataset.ready==='true';})()",'main-renderer');
      await waitFor(contents,"window.synkDesktop.authStatus().then(auth=>auth.status==='signed-out')",'signed-out');
      const state=await run("(async()=>({environment:await synkDesktop.getEnvironment(),auth:await synkDesktop.authStatus(),update:await synkDesktop.updateStatus(),node:typeof require,startup:typeof synkStartupUpdate,methods:['authSignUp','updateStatus','checkForUpdate','downloadUpdate','installUpdate','onUpdateChanged'].every(key=>typeof synkDesktop[key]==='function')}))()");
      check('native environment and fixed update bridges',state.environment.clientId==='platform'&&state.environment.nativeShell===true&&state.environment.version===config.version&&state.environment.platform==='win32'&&state.environment.arch==='x64'&&state.node==='undefined'&&state.startup==='undefined'&&state.methods);
      check('empty isolated account stays signed out',state.auth.configured===true&&state.auth.signedIn===false);
      check('startup current status reaches manual updater',state.update.state==='current'&&state.update.currentVersion===config.version&&state.update.currentBuildId===config.buildId&&state.update.latestVersion===config.version&&state.update.latestBuildId===config.buildId,state.update);
      check('startup window is disposed after gate passes',startupWindow.isDestroyed());
      await run("window.__qaUpdateStates=[];window.__qaUpdateOff=synkDesktop.onUpdateChanged(state=>__qaUpdateStates.push(state.state));true");
      const clickVisible=async(selector,name)=>{
        const probe=await run(`(()=>{const node=document.querySelector(${JSON.stringify(selector)});if(!node)return {ok:false,reason:'missing'};const style=getComputedStyle(node),rect=node.getBoundingClientRect();const visible=!node.hidden&&!node.disabled&&!node.closest('[hidden],[inert],[aria-hidden="true"]')&&style.display!=='none'&&style.visibility==='visible'&&style.pointerEvents!=='none'&&Number(style.opacity)>0&&rect.width>0&&rect.height>0&&rect.left>=0&&rect.top>=0&&rect.right<=window.innerWidth&&rect.bottom<=window.innerHeight;const x=rect.left+rect.width/2,y=rect.top+rect.height/2,hit=visible?document.elementFromPoint(x,y):null,unobscured=Boolean(hit&&(hit===node||node.contains(hit))),ok=visible&&unobscured;if(ok)node.click();return {ok,visible,unobscured,disabled:Boolean(node.disabled),rect:{left:Math.round(rect.left),top:Math.round(rect.top),width:Math.round(rect.width),height:Math.round(rect.height),right:Math.round(rect.right),bottom:Math.round(rect.bottom)},viewport:{width:window.innerWidth,height:window.innerHeight},point:{x:Math.round(x),y:Math.round(y)},hit:hit?{tag:hit.tagName,id:hit.id||null,className:String(hit.className||'')}:null};})()`);
        check(name,probe?.ok===true,probe);
      };
      // 검정 구 얼굴(PC 클라이언트 1단계, 1단계_구현설계.md 15절): 구만 보이고, 누르지 않아도 묻는 화면으로 커지고, 검사 실행 길로 솔리오까지 간다.
      await waitFor(contents,"(()=>{const p=document.getElementById('portal-entry'),l=document.querySelector('.launcher');return !!p&&!p.hidden&&p.dataset.portalActive==='true'&&(p.dataset.portalState==='welcome'||(window.__orbSeen||[]).includes('welcome'))&&p.dataset.portalAuthStatus==='signed-out'&&p.dataset.orbClient==='portal'&&!!l&&l.inert===true;})()",'orb-welcome');
      const welcome=await run("(()=>{const p=document.getElementById('portal-entry'),l=document.querySelector('.launcher'),c=p?.querySelector('.orb-canvas')?.getBoundingClientRect();return {portalState:p?.dataset.portalState,seen:window.__orbSeen||[],portalActive:p?.dataset.portalActive,orbClient:p?.dataset.orbClient,portalHidden:Boolean(p?.hidden),docPortalActive:document.documentElement.dataset.portalActive,launcherInert:Boolean(l?.inert),launcherInertAttr:Boolean(l?.hasAttribute('inert')),canvasCovers:!!c&&c.width>=innerWidth-1&&c.height>=innerHeight-1};})()");
      check('orb starts alone at welcome with launcher inert',(welcome.portalState==='welcome'||welcome.seen.includes('welcome'))&&!(welcome.seen.indexOf('welcome')<0?welcome.seen:welcome.seen.slice(0,welcome.seen.indexOf('welcome'))).some(s=>s&&s!=='welcome')&&welcome.portalActive==='true'&&welcome.orbClient==='portal'&&!welcome.portalHidden&&welcome.docPortalActive==='true'&&welcome.launcherInert&&welcome.launcherInertAttr&&welcome.canvasCovers,welcome);
      // 누르지 않는다. 복원 결과(로그아웃)가 나온 뒤 1.35초 기다림을 지나 스스로 커지는 것까지가 검사다
      await waitFor(contents,"(()=>{const p=document.getElementById('portal-entry'),s=p?.querySelector('.orb-stage');return !!p&&p.dataset.portalState==='auth'&&s?.dataset.ui==='ask';})()",'orb-auth');
      for(const width of [1280,1024]){
        created.setSize(width,800);await sleep(420);
        const ask=await run("(()=>Object.fromEntries([['signin','[data-orb-act=signin]'],['signup','[data-orb-act=signup]'],['code','#portal-invite-input']].map(([name,selector])=>{const node=document.querySelector('#portal-entry '+selector),rect=node.getBoundingClientRect(),hit=document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2);return [name,{text:node.innerText||node.placeholder,visible:!node.hidden&&getComputedStyle(node).visibility==='visible'&&rect.width>0&&rect.height>0&&rect.left>=0&&rect.right<=innerWidth,unobscured:Boolean(hit&&(hit===node||node.contains(hit)))}];})))()");
        check('orb ask shows sign-in, sign-up and the code field at '+width,ask.signin.visible&&ask.signin.unobscured&&ask.signin.text==='로그인'&&ask.signup.visible&&ask.signup.unobscured&&ask.signup.text==='처음이라면 가입하기'&&ask.code.visible&&ask.code.unobscured,ask);
        await capture(created,'platform-orb-ask-'+width);
      }
      await clickVisible('#portal-entry [data-orb-act="signup"]','orb sign-up visible and unobscured');
      await waitFor(contents,"(document.querySelector('#portal-entry [data-ask-note]')?.textContent||'').includes('브라우저에서 가입한 뒤')",'orb-signup-note');
      check('orb sign-up opens only the fixed URL through native IPC',opened.length===1&&opened[0].kind==='external'&&opened[0].url==='https://synk.im/id/?view=signup',opened);
      const signedOut=await run("(async()=>({auth:await synkDesktop.authStatus(),note:document.querySelector('#portal-entry [data-ask-note]').innerText,phase:document.getElementById('portal-entry').dataset.portalState}))()");
      check('orb sign-up keeps the native session signed out and stays on the ask scene',signedOut.auth.signedIn===false&&signedOut.note==='브라우저에서 가입한 뒤 「로그인」을 눌러 주세요.'&&signedOut.phase==='auth',signedOut);
      // 검사 실행 길: 본체에 심은 값(__synkNativeQAGuestEntry)으로만 열린다
      await run("document.getElementById('portal-entry').dispatchEvent(new CustomEvent('synk:qa-guest-entry'));true");
      await waitFor(contents,"(()=>{const p=document.getElementById('portal-entry'),s=p?.querySelector('.orb-stage');return !!p&&p.dataset.portalState==='entered'&&p.dataset.orbClient==='app'&&s?.dataset.ui==='app';})()",'orb-solio');
      const entered=await run("(async()=>{const p=document.getElementById('portal-entry'),l=document.querySelector('.launcher'),auth=await window.synkDesktop.authStatus();return {portalState:p?.dataset.portalState,portalActive:p?.dataset.portalActive,orbClient:p?.dataset.orbClient,say:(p?.querySelector('[data-say]')?.textContent||'').trim(),launcherInert:Boolean(l?.inert),auth:{configured:auth.configured,signedIn:auth.signedIn}};})()");
      check('orb QA guest path reaches the Solio first screen and keeps the account signed out',entered.portalState==='entered'&&entered.portalActive==='false'&&entered.orbClient==='app'&&entered.say==='로그인하면 구독별 남은 양이 여기에 보입니다.'&&entered.launcherInert&&entered.auth.configured===true&&entered.auth.signedIn===false,entered);
      // 방이 다 드러난 뒤 찍는다. 곧바로 찍으면 도착 움직임 도중이라 문장이 아직 보이지 않았다(0.4.95 대역 빌드 캡처)
      await waitFor(contents,"(()=>{const s=document.querySelector('#portal-entry .orb-stage'),say=document.querySelector('#portal-entry [data-layer=app] [data-say]');return !!s&&!!say&&s.classList.contains('settled')&&getComputedStyle(say.closest('.rise')||say).opacity==='1';})()",'orb-solio-shown');
      await capture(created,'platform-orb-solio');
      // 작은 구 → 공간 고르기 → 「설정」 → 옛 설정 보기(legacy)의 업데이트 확인. 내려받기 보기는 새 얼굴에서 갈 길이 없어 뺀다
      await clickVisible('#portal-entry .here-orb','orb small orb visible and unobscured');
      await waitFor(contents,"document.querySelector('#portal-entry .orb-stage')?.dataset.ui==='switch'",'orb-switch');
      await clickVisible('#portal-entry [data-foot="settings"]','orb switch settings visible and unobscured');
      await waitFor(contents,"document.documentElement.dataset.orbClient==='legacy'&&document.documentElement.dataset.view==='settings'",'orb-legacy-settings');
      // 임시 옛 화면에서는 옛 런처의 잠금이 풀려 마우스와 자판으로 눌려야 한다(Fable 최종). 프로그램 클릭은 잠긴 요소에도 통하므로 따로 본다
      const unlocked=await run("(()=>{const l=document.querySelector('.launcher'),back=document.querySelector('#portal-entry .legacy-back'),r=back?.getBoundingClientRect();return {launcherInert:Boolean(l?.inert),launcherInertAttr:Boolean(l?.hasAttribute('inert')),launcherAriaHidden:l?.getAttribute('aria-hidden')??null,backVisible:!!back&&!back.hidden&&!!r&&r.width>0&&r.height>0};})()");
      check('orb legacy view unlocks the old launcher and shows 「돌아가기」',!unlocked.launcherInert&&!unlocked.launcherInertAttr&&unlocked.launcherAriaHidden===null&&unlocked.backVisible,unlocked);
      for(const view of ['settings']){
        const prefix='platform-update-'+view;
        await run("document.getElementById('"+prefix+"-check').scrollIntoView({block:'center'});true");await sleep(120);
        await clickVisible('#'+prefix+'-check',view+' manual update check visible and unobscured');
        await waitFor(contents,"document.getElementById('"+prefix+"').dataset.updateState==='current'&&!document.getElementById('"+prefix+"-check').disabled",view+'-update-current');
        const ui=await run("(()=>({version:document.getElementById('"+prefix+"-version').innerText,status:document.getElementById('"+prefix+"-status').innerText,downloadHidden:document.getElementById('"+prefix+"-download').hidden,installHidden:document.getElementById('"+prefix+"-install').hidden,rootHidden:document.getElementById('"+prefix+"').hidden}))()");
        check(view+' manual update displays the current candidate',!ui.rootHidden&&ui.version==='지금 v'+config.version+' · 시험판'&&ui.status.startsWith('최신 버전이에요.')&&ui.status.includes('쓰는 동안에도')&&ui.downloadHidden&&ui.installHidden,ui);
        await capture(created,'platform-update-'+view);
      }
      const events=await run('window.__qaUpdateOff();window.__qaUpdateStates');
      check('manual checks emit real checking and current events',events.join(',')==='checking,current'&&feedRequests===2,{events,feedRequests});
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
const trace=(event,detail={})=>process.stderr.write('SYNK_QA_TRACE '+JSON.stringify({event,...detail})+'\n');
const rpc=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;trace('send',{id,method});const timer=setTimeout(()=>{pending.delete(id);reject(Error('INSPECTOR_TIMEOUT_'+method));},10000);pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});ws.send(JSON.stringify({id,method,params}));});
function connect(url){trace('connect');ws=new WebSocket(url);ws.addEventListener('open',async()=>{trace('open');try{await rpc('Debugger.enable');await rpc('Runtime.runIfWaitingForDebugger');}catch(e){error=e.message;trace('connect-error',{error});ws.close();}});ws.addEventListener('message',async event=>{const message=JSON.parse(event.data);if(message.id||message.method==='Debugger.paused'||message.method==='Debugger.resumed')trace('receive',{id:message.id,method:message.method,reason:message.params?.reason,url:message.params?.callFrames?.[0]?.url});if(message.id){const item=pending.get(message.id);if(item){pending.delete(message.id);message.error?item.reject(Error(message.error.message)):item.resolve(message.result);}return;}if(message.method==='Debugger.paused'&&!injected){injected=true;try{const result=await rpc('Debugger.evaluateOnCallFrame',{callFrameId:message.params.callFrames[0].callFrameId,expression:'('+observe.toString()+')('+JSON.stringify(input)+')',returnByValue:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));await rpc('Debugger.resume');}catch(e){error=e.message;try{await rpc('Debugger.evaluateOnCallFrame',{callFrameId:message.params.callFrames[0].callFrameId,expression:'require("electron").app.quit()'});await rpc('Debugger.resume');}catch{}ws.close();}}});}
const watchdog=setTimeout(async()=>{error='Native QA timeout; requested normal quit of owned QA process';try{await rpc('Runtime.evaluate',{expression:'globalThis.__synkNativeQAQuit?.()'});}catch{}ws?.close();},85000);
const hardDeadline=setTimeout(()=>{error=error||'Native QA process did not exit after normal quit';trace('owned-qa-final-deadline',{error});ws?.close();child.kill();},105000);
child.stdout.on('data',data=>{stdout+=data;if(stdout.includes('SYNK_STARTUP_QA_QUIT '))normalQuit=true;if(stdout.includes(input.prefix))ws?.close();});
child.stderr.on('data',data=>{stderr+=data;const match=stderr.match(/Debugger listening on (ws:\/\/127\.0\.0\.1:\d+\/[^\s]+)/);if(match&&!connected){connected=true;connect(match[1]);}});
child.on('error',e=>{error=e.message;});
child.on('close',code=>{clearTimeout(hardDeadline);clearTimeout(watchdog);ws?.close();let result;try{const line=stdout.split(/\r?\n/).find(line=>line.startsWith(input.prefix));result=JSON.parse(line.slice(input.prefix.length));}catch{}
  const unchanged=sha(archive)===before;
  const report={checkedAt:new Date().toISOString(),ok:code===0&&result?.ok===true&&normalQuit&&!error&&unchanged,code,error,normalQuit,asarSha256:before,packageBytesUnchanged:unchanged,buildSourceHash:release.sourceHash,result,...(!result?.ok?{stderr:stderr.slice(-5000),stdout:stdout.slice(-2000)}:{})};
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({ok:report.ok,passed:result?.checks.filter(check=>check.ok).length,checks:result?.checks.length,normalQuit,error:error||result?.errors,report:path.join(out,'report.json')}));if(!report.ok)process.exitCode=1;
});
