'use strict';
// Hidden Electron + actual care UI/download handler. Synthetic account and
// disposable profile only. Notification payload is observed; no OS modal opens.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),artifacts=path.join(root,'artifacts'),prefix='SYNK_CARE_RECOVERY_NATIVE ';
const reportFile=path.join(artifacts,'care-recovery-native-20261007.json');
function checkedProfile(value){
  const target=path.resolve(value||'');
  if(!value||path.dirname(target)!==path.resolve(os.tmpdir())||!path.basename(target).startsWith('synk-care-recovery-native-'))throw Error('Isolated temporary profile required');
  const stat=fs.lstatSync(target);if(!stat.isDirectory()||stat.isSymbolicLink()||fs.realpathSync(target)!==target)throw Error('Unsafe test profile');
  return target;
}
if(!process.versions.electron){
  const profile=checkedProfile(fs.mkdtempSync(path.join(os.tmpdir(),'synk-care-recovery-native-')));
  try{
    const run=require('node:child_process').spawnSync(require('electron'),[__filename,'--profile='+profile],{cwd:root,windowsHide:true,encoding:'utf8',timeout:60000});
    const line=run.stdout?.split(/\r?\n/).find(value=>value.startsWith(prefix));
    const report=line?JSON.parse(line.slice(prefix.length)):{ok:false,error:run.error?.message||'NO_RESULT',stderr:run.stderr?.slice(-1200)};
    fs.mkdirSync(artifacts,{recursive:true});fs.writeFileSync(reportFile,JSON.stringify(report,null,2)+'\n');
    process.stdout.write(JSON.stringify({...report,report:reportFile},null,2)+'\n');if(!report.ok)process.exitCode=1;
  }finally{fs.rmSync(checkedProfile(profile),{recursive:true,force:true,maxRetries:20,retryDelay:300});}
}else{
  const {app,BrowserWindow,session,Menu}=require('electron');
  const {preferences}=require('../src/security.cjs');
  const {PRODUCT_PREVIEWS,productPolicy,productResource,createProductDownloadHandler,productDownloadNotice}=require('../src/product-preview.cjs');
  const profile=checkedProfile(process.argv.find(value=>value.startsWith('--profile='))?.slice(10));
  const downloads=path.join(profile,'downloads');fs.mkdirSync(downloads);
  app.enableSandbox();app.setPath('userData',profile);app.setPath('sessionData',path.join(profile,'session'));
  app.whenReady().then(async()=>{
    let window,complete;const checks=[],errors=[],blocked=[],notices=[];
    const check=(name,passed,details)=>{checks.push({name,passed:!!passed,...(details?{details}:{})});if(!passed)throw Error(name);};
    const run=script=>window.webContents.executeJavaScript(script);
    const wait=async predicate=>{for(let i=0;i<200;i++){if(await run(predicate))return;await new Promise(resolve=>setTimeout(resolve,30));}throw Error('UI_TIMEOUT');};
    const owner='synthetic-native-recovery-owner',foreign='synthetic-other-owner',key='synk.care.account.v1.'+owner;
    const raw=JSON.stringify({version:1,accountId:owner,pending:true,state:{invalid:'합성 손상 원본만'}});
    const foreignRaw=JSON.stringify({version:1,accountId:foreign,pending:true,state:{invalid:'다른 계정은 내보내지 않음'}});
    try{
      const {emptyState}=await import(require('node:url').pathToFileURL(path.resolve(root,'../experiences/relationship-care/model.mjs')).href);
      const preload=path.join(profile,'recovery-fixture.cjs');
      fs.writeFileSync(preload,`const {contextBridge}=require('electron');
        const status=()=>({configured:true,signedIn:true,status:'signed-in',sessionGeneration:1,account:{synk_user_id:${JSON.stringify(owner)},display_name:'합성 복구 시험'}});
        if(location.origin==='http://127.0.0.1:4296'){
          localStorage.setItem(${JSON.stringify(key)},${JSON.stringify(raw)});
          localStorage.setItem(${JSON.stringify('synk.care.account.v1.'+foreign)},${JSON.stringify(foreignRaw)});
          localStorage.setItem('synk.care.account.v1.unknown','{unreadable raw');
        }
        contextBridge.exposeInMainWorld('synkProduct',{getEnvironment:async()=>({clientId:'care',synthetic:true}),authStatus:async()=>status(),onAuthChanged:()=>()=>{},accountRequest:async action=>{if(action!=='careLoad')throw Error('Unexpected write');return {ok:true,scope:'synk-care',accountId:${JSON.stringify(owner)},revision:0,state:${JSON.stringify(emptyState())}};}});`);
      Menu.setApplicationMenu(null);
      const ownSession=session.fromPartition('care-recovery-native-synthetic');
      ownSession.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));ownSession.setPermissionCheckHandler(()=>false);
      ownSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*','file://*/*']},(details,callback)=>{const denied=!productResource('care',details.url);if(denied)blocked.push(details.url);callback({cancel:denied});});
      ownSession.webRequest.onHeadersReceived((details,callback)=>callback({responseHeaders:{...details.responseHeaders,'Content-Security-Policy':[productPolicy()]}}));
      ownSession.on('will-download',createProductDownloadHandler({id:'care',getWindow:()=>window,configureSave(item){
        const target=path.join(downloads,item.getFilename());if(path.dirname(target)!==downloads)throw Error('Unsafe download target');
        item.setSavePath(target);item.once('done',(_event,state)=>complete?.({state,filename:item.getFilename(),text:fs.existsSync(target)?fs.readFileSync(target,'utf8'):null}));
      },onDenied(reason){const notice=productDownloadNotice(reason);notices.push({reason,notice});complete?.({denied:true,reason,notice});}}));
      window=new BrowserWindow({width:1280,height:900,useContentSize:true,show:false,webPreferences:{...preferences(preload),session:ownSession,backgroundThrottling:false}});
      window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('console-message',event=>{if(event.level==='error')errors.push(event.message.slice(0,300));});
      await window.loadURL(PRODUCT_PREVIEWS.care.entry);await wait("document.documentElement.dataset.ready==='true'&&!document.getElementById('account-export-local').hidden");
      check('actual-care-UI-has-authenticated-recovery-action',await run("document.getElementById('account-detail').textContent.includes('원본을 그대로 보존')&&typeof require==='undefined'"));
      const finished=()=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('DOWNLOAD_TIMEOUT')),7000);complete=result=>{clearTimeout(timer);resolve(result);};});
      let pending=finished();await run("document.getElementById('account-export-local').click()");const saved=await pending;
      check('production-handler-saves-real-UI-recovery-JSON',saved.state==='completed'&&saved.filename==='synk-care-local-recovery.json');
      const value=JSON.parse(saved.text);
      check('native-recovery-preserves-exact-owned-raw-without-other-or-unknown-account',value.accountId===owner&&value.entries.length===1&&value.entries[0].key===key&&value.entries[0].raw===raw);
      check('export-does-not-delete-device-originals',await run(`localStorage.getItem(${JSON.stringify(key)})===${JSON.stringify(raw)}&&localStorage.getItem(${JSON.stringify('synk.care.account.v1.'+foreign)})===${JSON.stringify(foreignRaw)}`));
      const body='{"synthetic":true}';
      for(const [filename,mime]of [['synk-care-local-recovery.exe','application/json'],['synk-care-local-recovery.json','text/html']]){
        pending=finished();await run(`(()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([${JSON.stringify(body)}],{type:${JSON.stringify(mime)}}));a.download=${JSON.stringify(filename)};a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);})()`);const denied=await pending;
        check('reject-'+(mime==='text/html'?'wrong-MIME':'wrong-filename'),denied.denied===true&&denied.reason==='type'&&denied.notice.type==='warning'&&denied.notice.detail.includes('저장되지 않았어요')&&denied.notice.detail.includes('지우지 마세요'));
      }
      check('rejections-never-write-a-file-or-replace-successful-recovery',fs.readdirSync(downloads).length===1&&fs.readFileSync(path.join(downloads,saved.filename),'utf8')===saved.text);
      check('native-window-and-profile-stay-isolated',!window.isVisible()&&app.getPath('userData')===profile&&app.getPath('sessionData')===path.join(profile,'session'));
      check('no-browser-errors-or-external-requests',errors.length===0&&blocked.length===0,{errors,blocked});
      const sourceFiles=['product-preview.cjs','product-main.cjs'];
      const hashes=Object.fromEntries(sourceFiles.map(name=>[name,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'src',name))).digest('hex')]));
      const report={ok:true,at:new Date().toISOString(),scope:'Actual hidden Electron care UI, actual Blob download handler, authenticated synthetic recovery; no user profile or real login.',notificationVerification:'Production rejection callback and productDownloadNotice payload verified; OS modal intentionally not displayed.',checks,notices,sourceHashes:hashes,downloadSha256:crypto.createHash('sha256').update(saved.text).digest('hex'),realLogin:false,remoteMutation:false};
      process.stdout.write(prefix+JSON.stringify(report)+'\n');window.destroy();app.exit(0);
    }catch(error){process.stdout.write(prefix+JSON.stringify({ok:false,error:error.message,checks,errors,blocked,notices})+'\n');window?.destroy();app.exit(1);}
  });
}
