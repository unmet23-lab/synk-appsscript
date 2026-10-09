'use strict';
// Isolated renderer QA only: synthetic roles, no credentials, network or launch.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const root=path.resolve(__dirname,'..'),artifacts=path.join(root,'artifacts/messenger-teacher-20261009');
if(!process.versions.electron){
  const {spawnSync}=require('node:child_process'),profile=fs.mkdtempSync(path.join(os.tmpdir(),'synk-teaching-group-'));
  try{
    const run=spawnSync(require('electron'),[__filename,'--profile='+profile],{cwd:root,encoding:'utf8',windowsHide:true,timeout:60000});
    const line=run.stdout?.split(/\r?\n/).find(value=>value.startsWith('SYNK_TEACHING_GROUP ')),result=line?JSON.parse(line.slice('SYNK_TEACHING_GROUP '.length)):{ok:false,error:run.error?.message||'NO_RESULT',stderr:run.stderr?.slice(-1500)};
    fs.mkdirSync(artifacts,{recursive:true});fs.writeFileSync(path.join(artifacts,'platform-ui.json'),JSON.stringify(result,null,2)+'\n');
    console.log(JSON.stringify({ok:result.ok,checks:result.checks?.length,failures:result.checks?.filter(row=>!row.ok),consoleErrors:result.consoleErrors,networkRequests:result.networkRequests,error:result.error}));if(!result.ok)process.exitCode=1;
  }finally{
    if(path.dirname(path.resolve(profile))!==path.resolve(os.tmpdir())||!path.basename(profile).startsWith('synk-teaching-group-'))throw Error('Unsafe temporary profile');
    fs.rmSync(profile,{recursive:true,force:true,maxRetries:20,retryDelay:300});
  }
}else{
  const {app,BrowserWindow,protocol,session,Menu}=require('electron'),{createNativeContent}=require('../src/native-content.cjs'),{preferences}=require('../src/security.cjs');
  const profile=process.argv.find(value=>value.startsWith('--profile='))?.slice(10);
  if(!profile||path.dirname(profile)!==os.tmpdir()||!path.basename(profile).startsWith('synk-teaching-group-'))throw Error('Isolated profile required');
  app.enableSandbox();app.setPath('userData',profile);app.commandLine.appendSwitch('force-device-scale-factor','1');protocol.registerSchemesAsPrivileged([{scheme:'synk-desktop',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
  app.whenReady().then(async()=>{
    let window;const checks=[],errors=[],requests=[];
    try{
      Menu.setApplicationMenu(null);const own=session.fromPartition('teaching-group-'+Date.now());own.setPermissionRequestHandler((_c,_p,done)=>done(false));own.setPermissionCheckHandler(()=>false);
      own.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(details,done)=>{requests.push(details.url);done({cancel:true});});own.protocol.handle('synk-desktop',createNativeContent({appRoot:root}));
      window=new BrowserWindow({width:1280,height:900,useContentSize:true,show:false,frame:false,webPreferences:{...preferences(path.join(__dirname,'renderer-account-fixture.cjs')),session:own,backgroundThrottling:false}});window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('console-message',details=>{if(details.level==='error')errors.push(String(details.message));});
      const run=source=>window.webContents.executeJavaScript(source),settle=async()=>{await run("document.fonts.ready.then(()=>Promise.all([...document.images].filter(i=>i.getAttribute('src')).map(i=>i.decode().catch(()=>{}))))");await new Promise(resolve=>setTimeout(resolve,140));};
      await window.loadURL('synk-desktop://platform/index.html');let ready=false;
      for(let i=0;i<150;i++){if(await run("document.documentElement.dataset.ready==='true'")){ready=true;break;}await new Promise(resolve=>setTimeout(resolve,20));}if(!ready)throw Error('Renderer ready timeout');
      await run("document.querySelector('[data-view=library]').click()");let generation=1;
      for(const width of [1280,390,320])for(const [role,appIds,visible]of [['dual',['messenger','teacher'],'messenger'],['teacher',['teacher'],'teacher'],['company',['messenger'],'messenger']]){
        window.setContentSize(width,900);const id=role+'-'+width,state={configured:true,status:'signed-in',signedIn:true,sessionGeneration:generation++,account:{synk_user_id:id},library:{status:'ready',appIds}};
        await run('window.__synkFixture.switchAccount('+JSON.stringify(state)+')');await settle();await run("document.getElementById('"+(role==='dual'?'teaching-action':'primary-action')+"').scrollIntoView({block:'center'})");await settle();
        const info=await run("(()=>{const $=id=>document.getElementById(id);return {ids:[...document.querySelectorAll('[data-app]')].map(n=>n.dataset.app),count:$('library-count').textContent,name:$('breadcrumb-app').textContent,teachingHidden:$('teaching-action').hidden,teachingDisabled:$('teaching-action').disabled,primary:$('primary-action').textContent,pageOverflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),mainOverflow:Math.max(0,$('main').scrollWidth-$('main').clientWidth),heroOverflow:Math.max(0,$('hero').scrollWidth-$('hero').clientWidth)};})()");
        info.actionClickable=await run("(()=>{const button=document.getElementById('"+(role==='dual'?'teaching-action':'primary-action')+"'),rect=button.getBoundingClientRect(),hit=document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2);return button===hit||button.contains(hit);})()");
        info.primarySingleLine=await run("(()=>{const range=document.createRange();range.selectNodeContents(document.getElementById('primary-action'));return range.getClientRects().length===1;})()");
        const ok=JSON.stringify(info.ids)===JSON.stringify([visible])&&info.count==='01'&&info.pageOverflow===0&&info.mainOverflow===0&&info.heroOverflow===0&&info.actionClickable&&info.primarySingleLine&&(role==='dual'?!info.teachingHidden&&!info.teachingDisabled:info.teachingHidden)&&(role!=='teacher'||info.name==='메신저 · 내 수업'&&info.primary==='내 수업 열기');
        await window.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});await new Promise(resolve=>setTimeout(resolve,100));fs.mkdirSync(artifacts,{recursive:true});const screenshot=path.join(artifacts,'platform-'+role+'-'+width+'.png');fs.writeFileSync(screenshot,(await window.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());checks.push({name:role+'-'+width,ok,...info,screenshot});
      }
      const result={ok:checks.every(row=>row.ok)&&errors.length===0&&requests.length===0,scope:'Isolated hidden Electron renderer with synthetic role IPC; no authentication, account API, app launch, installation or public deployment',checks,consoleErrors:errors,networkRequests:requests};console.log('SYNK_TEACHING_GROUP '+JSON.stringify(result));window.destroy();app.exit(result.ok?0:1);
    }catch(error){console.log('SYNK_TEACHING_GROUP '+JSON.stringify({ok:false,error:error.message,checks,consoleErrors:errors,networkRequests:requests}));window?.destroy();app.exit(1);}
  });
}
