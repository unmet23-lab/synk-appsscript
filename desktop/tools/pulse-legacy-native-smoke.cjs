'use strict';
// When the old PULSE brief view opens and how it renders. Existing native renderer QA pattern: hidden windows,
// synthetic preload and fresh AppData, all HTTP(S)/WebSocket blocked, so the running app, its account and its data
// are never touched. --app-root also takes an installed app.asar: the same checks then read the bytes a release put on this PC.
//   node tools/pulse-legacy-native-smoke.cjs --out=<folder> [--app-root=<folder|app.asar>] [--widths=1440,390] [--theme=day] [--captures-only] [--electron=<exe>]
// --captures-only skips the checks of the 21-model catalogue, for capturing a build older than it.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const arg=name=>process.argv.find(value=>value.startsWith('--'+name+'='))?.slice(name.length+3);
const flag=name=>process.argv.includes('--'+name);
const tools=__dirname,prefix='SYNK_PULSE_LEGACY ';
if(!process.versions.electron){
  const appRoot=path.resolve(arg('app-root')||path.join(tools,'..')),out=path.resolve(arg('out')||''),electron=arg('electron')||require('electron');
  if(!arg('out'))throw Error('--out=<folder> required');
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'synk-pulse-legacy-'));
  for(const folder of ['Roaming','Local','Temp'])fs.mkdirSync(path.join(profile,folder),{recursive:true});
  fs.mkdirSync(out,{recursive:true});
  const env={...process.env,APPDATA:path.join(profile,'Roaming'),LOCALAPPDATA:path.join(profile,'Local'),TEMP:path.join(profile,'Temp'),TMP:path.join(profile,'Temp')};delete env.ELECTRON_RUN_AS_NODE;
  const passed=['--widths='+(arg('widths')||'1440,390'),'--theme='+(arg('theme')||''),...(flag('captures-only')?['--captures-only']:[])];
  const result=require('node:child_process').spawnSync(electron,[__filename,'--profile='+profile,'--app-root='+appRoot,'--out='+out,...passed],{cwd:tools,windowsHide:true,encoding:'utf8',timeout:360000,maxBuffer:32*1024*1024,env});
  const line=result.stdout?.split(/\r?\n/).find(value=>value.startsWith(prefix));
  const report=line?JSON.parse(line.slice(prefix.length)):{ok:false,error:result.error?.message||'NO_RESULT',stderr:result.stderr?.slice(-3000)};
  report.appRoot=appRoot;report.processExitCode=result.status;if(result.status!==0)report.ok=false;
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:300});}catch{/* Electron may hold the profile a moment longer; it stays under TEMP. */}
  process.stdout.write(JSON.stringify({ok:report.ok,checks:report.checks?.length,failed:report.checks?.filter(item=>!item.ok),error:report.error,stderr:report.stderr,consoleErrors:report.consoleErrors,networkRequests:report.networkRequests,report:path.join(out,'report.json')},null,2)+'\n');
  process.exit(report.ok?0:1);
}
const {app,BrowserWindow,protocol,session,Menu}=require('electron');
const profile=arg('profile');
if(!profile||!path.basename(profile).startsWith('synk-pulse-legacy-'))throw Error('Explicit isolated profile required');
const appRoot=arg('app-root'),out=arg('out'),widths=arg('widths').split(',').map(Number),theme=arg('theme');
const {createNativeContent}=require(path.join(appRoot,'src/native-content.cjs')),{preferences}=require(path.join(appRoot,'src/security.cjs'));
app.enableSandbox();app.setPath('appData',path.join(profile,'Roaming'));app.setPath('userData',path.join(profile,'UserData'));app.setPath('sessionData',path.join(profile,'Session'));app.commandLine.appendSwitch('force-device-scale-factor','1');
protocol.registerSchemesAsPrivileged([{scheme:'synk-desktop',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
// Sequential scenarios close their isolated window before creating the next one.
app.on('window-all-closed',()=>{});
// The shape a brief had when the catalogue held six models and one work.
const OLD_DRAFT={models:['M01','F02','M03','F03','M02','F01'],works:['model-casting'],brief:{brand:'합성 브랜드',goal:'합성 목표',channel:'합성 채널',deadline:'합성 일정',notes:'합성 메모'}};
const SAME=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
app.whenReady().then(async()=>{
  const checks=[],errors=[],requests=[],shots=[];let window,sequence=0;
  const check=(name,ok,details={})=>checks.push({name,ok:!!ok,...details});
  const run=script=>window.webContents.executeJavaScript(script);
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const settle=async()=>{await run('document.fonts.ready');await wait(80);};
  const click=async selector=>{await run('document.querySelector('+JSON.stringify(selector)+').click()');await settle();};
  const account=async owner=>{await run('window.__synkCatalogFixture.switchAccount('+JSON.stringify({configured:true,status:'signed-in',signedIn:true,sessionGeneration:1,account:{synk_user_id:owner,display_name:'합성 '+owner},library:{status:'ready',appIds:[]}})+')');await settle();};
  const ready=async()=>{for(let attempt=0;attempt<400;attempt++){let state=null;try{state=await run('document.documentElement.dataset.ready');}catch{/* Reloading. */}if(state==='true')return;if(state==='error')throw Error('Renderer init failed');await wait(25);}throw Error('Renderer not ready');};
  async function open(width=1440,height=900,seed=''){
    if(window&&!window.isDestroyed())window.destroy();
    const isolated=session.fromPartition('pulse-legacy-'+Date.now()+'-'+(sequence++));
    isolated.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));isolated.setPermissionCheckHandler(()=>false);
    isolated.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(details,callback)=>{requests.push({url:details.url,method:details.method});callback({cancel:true});});
    isolated.protocol.handle('synk-desktop',createNativeContent({appRoot}));
    window=new BrowserWindow({width,height,useContentSize:true,show:false,frame:false,webPreferences:{...preferences(path.join(tools,'development-catalog-fixture.cjs')),session:isolated,backgroundThrottling:false,additionalArguments:['--catalog-fixture=development']}});
    window.webContents.setWindowOpenHandler(details=>{requests.push({windowOpen:details.url});return {action:'deny'};});window.webContents.on('console-message',event=>{if(event.level==='error')errors.push(event.message);});
    await window.loadURL('synk-desktop://platform/index.html');await ready();
    if(seed){await run(seed);await window.webContents.reload();await wait(250);await ready();}
  }
  const openFromSettings=async()=>{await click('[data-view="settings"]');await click('#diagnostics [data-pulse-legacy]');await wait(80);};
  const measure=imagesIn=>run(`(()=>{const root=document.getElementById('pulse-client'),images=[...document.querySelectorAll(${JSON.stringify(imagesIn+' img')})],main=document.getElementById('main');return {innerWidth,doc:document.documentElement.scrollWidth,main:[main.scrollWidth,main.clientWidth],images:images.length,broken:images.filter(image=>image.complete&&image.naturalWidth===0).map(image=>image.getAttribute('src')),notLoaded:images.filter(image=>!image.complete).length,over:[...root.querySelectorAll('*')].filter(node=>{const box=node.getBoundingClientRect();return box.width>0&&box.right>innerWidth+1;}).map(node=>node.tagName+'.'+node.className).slice(0,8),text:root.innerText};})()`);
  // A tab is measured and captured at its full height; a dialog keeps the window size and answers only for its own images.
  async function capture(name,{full=true}={}){
    await settle();
    const [width,height]=window.getContentSize(),imagesIn=full?'#pulse-client':'#pulse-client dialog';let shotHeight=height;
    if(full){shotHeight=Math.min(9000,await run(`Math.max(document.getElementById('main').scrollHeight,document.documentElement.scrollHeight,${height})`));window.setContentSize(width,shotHeight);await wait(350);}
    await run(`Promise.all([...document.querySelectorAll(${JSON.stringify(imagesIn+' img')})].map(image=>{image.loading='eager';return image.complete?0:new Promise(resolve=>{image.onload=image.onerror=resolve;setTimeout(resolve,2500);});}))`);await wait(100);
    // The first capture of a hidden window can return the previous frame.
    window.webContents.invalidate();await window.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});await wait(180);
    fs.writeFileSync(path.join(out,name+'.png'),(await window.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
    const {text,...measured}=await measure(imagesIn);fs.writeFileSync(path.join(out,name+'.txt'),text);if(full)window.setContentSize(width,height);
    shots.push({name,height:shotHeight,...measured});
    check(name+'-no-sideways-overflow',measured.doc<=measured.innerWidth+1&&measured.main[0]<=measured.main[1]+1&&!measured.over.length,{doc:measured.doc,innerWidth:measured.innerWidth,main:measured.main,over:measured.over});
    check(name+'-no-broken-images',!measured.broken.length&&!measured.notLoaded,{images:measured.images,broken:measured.broken,notLoaded:measured.notLoaded});
  }
  try{
    fs.mkdirSync(out,{recursive:true});Menu.setApplicationMenu(null);
    await open();await account('probe-a');
    await click('[data-view="library"]');const before=await run('window.__synkCatalogFixture.calls().length');await click('#app-list [data-app="pulse"]');await wait(120);
    check('sidebar-pulse-opens-the-pulse-window-not-this-view',await run('window.__synkCatalogFixture.calls().slice('+before+').some(call=>call.operation==="pulse-app")&&document.getElementById("pulse-client").hidden'));
    await click('[data-view="settings"]');
    const row=await run(`(()=>{const button=document.querySelector('#diagnostics [data-pulse-legacy]');return button?{label:button.textContent,term:button.closest('dd')?.previousElementSibling?.textContent}:null;})()`);
    check('settings-lists-the-saved-draft-entry',!!row,{row});
    await click('#diagnostics [data-pulse-legacy]');await wait(80);
    check('settings-entry-opens-this-view',await run('!document.getElementById("pulse-client").hidden&&document.documentElement.dataset.view==="library"'),{firstText:await run('document.getElementById("pulse-client").innerText.slice(0,240)')});
    await open();await account('probe-a');await click('[data-view="library"]');
    check('fresh-library-has-no-entry',!await run('!!document.querySelector("#detail-content [data-pulse-legacy]")'),{selected:await run('document.querySelector("#app-list [aria-pressed=true]")?.dataset.app')});
    await open(1440,900,`localStorage.setItem('synk-launcher-view-v1:account:probe-b',JSON.stringify({selected:'pulse'}));`);await account('probe-b');await click('[data-view="library"]');
    check('pulse-left-selected-by-an-older-version-shows-the-entry',await run('!!document.querySelector("#detail-content [data-pulse-legacy]")&&!document.getElementById("app-detail").hidden'));
    // A brief saved when the catalogue held six models and one work.
    const seed=`localStorage.setItem('synk.pulse.brief.v1:'+encodeURIComponent('probe-c'),${JSON.stringify(JSON.stringify(OLD_DRAFT))});`;
    await open(1440,900,seed);await account('probe-c');await openFromSettings();
    const openedOn=await run('document.querySelector("#pulse-client [aria-current=page]")?.textContent');
    await click('#pulse-client [data-pulse-tab="brief"]');
    const draft=await run(`(()=>{const root=document.getElementById('pulse-client');return {shortlist:[...root.querySelectorAll('.pulse-selected-row strong')].map(node=>node.textContent),fields:[...root.querySelectorAll('[data-pulse-field]')].map(node=>node.value),request:root.querySelector('#pulse-request-text')?.value,message:root.querySelector('#pulse-message')?.textContent};})()`);
    check('old-draft-keeps-its-six-models',['이안','하린','유호','서진','태준','유나'].every(name=>draft.shortlist.includes(name)),{openedOn,shortlist:draft.shortlist,message:draft.message});
    check('old-draft-keeps-its-work',/PULSE AI 모델 캐스팅/.test(draft.request||''),{request:draft.request});
    check('old-draft-keeps-its-text',['합성 브랜드','합성 목표','합성 채널','합성 일정','합성 메모'].every(value=>draft.fields.includes(value)),{fields:draft.fields});
    if(!flag('captures-only')){
      check('old-draft-opens-on-its-brief',/제작 요청 정리/.test(openedOn),{openedOn});
      await click('#pulse-client [data-pulse-tab="portfolio"]');
      check('retired-work-stays-listed-while-picked',await run(`document.querySelectorAll('#pulse-client .pulse-work-card').length===4&&!!document.querySelector('#pulse-client [data-pulse-work="model-casting"]')`));
      await click('#pulse-client button.pulse-pick[data-pulse-pick-work="model-casting"]');
      check('removed-retired-work-leaves-the-three-works',await run(`document.querySelectorAll('#pulse-client .pulse-work-card').length===3&&!document.querySelector('#pulse-client [data-pulse-work="model-casting"]')`));
      await click('#pulse-client [data-pulse-tab="models"]');await click('#pulse-client button.pulse-pick[data-pulse-pick-model="F08"]');await click('#pulse-client [data-pulse-tab="brief"]');await click('#pulse-client [data-pulse-save]');
      const stored=await run(`JSON.parse(localStorage.getItem('synk.pulse.brief.v1:'+encodeURIComponent('probe-c')))`);
      check('saving-keeps-the-new-pick-and-the-removal',stored.models.includes('F08')&&stored.models.length===7&&!stored.works.length,{stored:{models:stored.models,works:stored.works}});
      check('request-names-the-team',/윤슬 \(F08\) · 가상 AI 모델 · OFALIN/.test(await run(`document.getElementById('pulse-request-text').value`)));
      // First visit, nothing saved.
      await open();await account('probe-d');await openFromSettings();
      const names=()=>run(`[...document.querySelectorAll('#pulse-results .pulse-model-card h3')].map(node=>node.textContent)`),teams=()=>run(`[...document.querySelectorAll('#pulse-results .pulse-team h2')].map(node=>node.firstChild.textContent.trim())`);
      const search=async value=>{await run(`(()=>{const input=document.getElementById('pulse-search');input.value=${JSON.stringify(value)};input.dispatchEvent(new Event('input',{bubbles:true}));})()`);await settle();};
      check('no-draft-opens-on-the-models',/모델 캐스팅/.test(await run('document.querySelector("#pulse-client [aria-current=page]")?.textContent')));
      check('twenty-one-models-and-two-teams',(await names()).length===21&&SAME(await teams(),['OFALIN','OUTBLUE']),{names:await names()});
      await search('오팔린');check('korean-team-name-finds-that-team',SAME(await names(),['윤슬','로하','새봄','해인'])&&SAME(await teams(),['OFALIN']));
      await search('없는낱말');check('nothing-found-says-so',await run(`!!document.querySelector('#pulse-results .pulse-empty')`));await click('#pulse-client [data-pulse-reset]');
      await click('#pulse-client [data-pulse-gender="남"]');check('gender-filter-keeps-the-matching-team',SAME(await teams(),['OUTBLUE'])&&(await names()).length===10);await click('#pulse-client [data-pulse-gender="all"]');
      await click('#pulse-client [data-pulse-tab="portfolio"]');check('three-works-with-no-draft',await run(`document.querySelectorAll('#pulse-client .pulse-work-card').length`)===3);
      // A glyph missing from the body font falls through to the next family: measure with two different last families.
      let screenText=await run(`document.getElementById('pulse-client').innerText`);
      for(const tab of ['models','brief']){await click('#pulse-client [data-pulse-tab="'+tab+'"]');screenText+=await run(`document.getElementById('pulse-client').innerText`);}
      const missing=await run(`(()=>{const context=document.createElement('canvas').getContext('2d'),width=(font,glyph)=>{context.font=font;return context.measureText(glyph).width;};return [...new Set(${JSON.stringify(screenText)})].filter(glyph=>glyph.trim()&&width('16px SUIT, monospace',glyph)!==width('16px SUIT, serif',glyph));})()`);
      check('korean-glyphs-are-all-in-the-body-font',!missing.some(glyph=>/[가-힣]/.test(glyph)),{missing});
    }
    for(const width of widths){
      await open(width,width<600?812:900,seed+(theme?`localStorage.setItem('synk-platform-theme',${JSON.stringify(theme)});`:''));await account('probe-c');await openFromSettings();
      const label=name=>(theme?theme+'-':'')+width+'-'+name;
      for(const tab of ['models','portfolio','brief']){
        await click('#pulse-client [data-pulse-tab="'+tab+'"]');
        await capture(label(tab));
      }
      await click('#pulse-client [data-pulse-tab="models"]');await click('#pulse-client [data-pulse-model]');
      await capture(label('dialog-model'),{full:false});check(label('dialog-model')+'-opens',await run('document.querySelector("#pulse-client dialog").open'));await click('#pulse-client [data-pulse-close]');
      await click('#pulse-client [data-pulse-tab="portfolio"]');await click('#pulse-client [data-pulse-work]');
      await capture(label('dialog-work'),{full:false});check(label('dialog-work')+'-opens',await run('document.querySelector("#pulse-client dialog").open'));await click('#pulse-client [data-pulse-close]');
      await click('#pulse-client [data-pulse-work="model-casting"]');
      await capture(label('dialog-retired-work'),{full:false});check(label('dialog-retired-work')+'-opens',await run('document.querySelector("#pulse-client dialog").open'));await click('#pulse-client [data-pulse-close]');
    }
    check('no-console-errors',!errors.length,{errors});
    check('no-outside-requests',!requests.length,{requests});
    process.stdout.write(prefix+JSON.stringify({ok:checks.every(item=>item.ok),checks,shots,consoleErrors:errors,networkRequests:requests})+'\n');
    app.exit(0);
  }catch(error){process.stdout.write(prefix+JSON.stringify({ok:false,error:error.stack||error.message,checks,consoleErrors:errors,networkRequests:requests})+'\n');app.exit(1);}
});
