'use strict';
// Real Windows StartupApproved checks, limited to one random QA registration.
// No user profile, window, input, login, reboot, or network operation is used.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),prefix='SYNK_STARTUP_RESUME_QA ',RUN='HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run',APPROVED='HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run';
const argument=name=>process.argv.find(value=>value.startsWith('--'+name+'='))?.slice(name.length+3);
const query=(key,name)=>spawnSync('reg.exe',['query',key,...(name?['/v',name]:[])],{windowsHide:true,encoding:'utf8'});
const digest=value=>crypto.createHash('sha256').update(value||'').digest('hex');
const snapshot=()=>Object.fromEntries([RUN,APPROVED].map(key=>{const result=query(key);return [key,{exists:result.status===0,sha256:digest(result.stdout)}];}));
const safeProfile=value=>path.dirname(path.resolve(value||''))===path.resolve(os.tmpdir())&&path.basename(value).startsWith('synk-startup-resume-os-');

if(!process.versions.electron){
  if(process.platform!=='win32')throw Error('Windows-only verification');
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'synk-startup-resume-os-')),name='SYNK.QA.StartupResume.'+crypto.randomUUID(),before=snapshot();
  const out=path.join(root,'../docs/_ops/qa/platform-convenience-20261009/startup-resume-os.json');let report;
  try{
    if([name,name+'.Other'].some(qaName=>query(RUN,qaName).status===0||query(APPROVED,qaName).status===0))throw Error('QA name already exists');
    const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
    const run=spawnSync(require('electron'),[__filename,'--profile='+profile,'--qa-name='+name],{windowsHide:true,env,encoding:'utf8',timeout:25000});
    const line=run.stdout?.split(/\r?\n/).find(value=>value.startsWith(prefix));report=line?JSON.parse(line.slice(prefix.length)):{ok:false,error:run.error?.message||'NO_RESULT',stderr:run.stderr?.slice(-1000)};report.electronExitCode=run.status;report.ok=!!report.ok&&run.status===0&&!run.error;
  }finally{
    for(const key of [RUN,APPROVED])for(const qaName of [name,name+'.Other'])if(query(key,qaName).status===0)spawnSync('reg.exe',['delete',key,'/v',qaName,'/f'],{windowsHide:true,encoding:'utf8'});
    if(!safeProfile(profile))throw Error('Unsafe QA profile');fs.rmSync(profile,{recursive:true,force:true,maxRetries:30,retryDelay:200});
    report??={ok:false,error:'OUTER_RUN_FAILED'};const after=snapshot();report.cleanup={qaRunAbsent:[name,name+'.Other'].every(qaName=>query(RUN,qaName).status!==0),qaApprovedAbsent:[name,name+'.Other'].every(qaName=>query(APPROVED,qaName).status!==0),temporaryProfileRemoved:!fs.existsSync(profile),existingStartupRegistryUnchanged:JSON.stringify(before)===JSON.stringify(after)};report.ok=report.ok&&Object.values(report.cleanup).every(Boolean);
    fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({ok:report.ok,checks:report.checks?.length,error:report.error,cleanup:report.cleanup,report:out},null,2));if(!report.ok)process.exitCode=1;
  }
}else{
  const {app,globalShortcut}=require('electron'),{createDesktopPreferences}=require('../src/desktop-preferences.cjs');
  const profile=argument('profile'),name=argument('qa-name');if(!safeProfile(profile)||!/^SYNK\.QA\.StartupResume\.[0-9a-f-]{36}$/.test(name||''))throw Error('Isolated QA identity required');
  app.enableSandbox();app.setName(name);app.setAppUserModelId(name);app.setPath('userData',profile);app.setPath('sessionData',path.join(profile,'Session'));
  app.whenReady().then(()=>{
    const startup={path:process.execPath,args:['--synk-autostart'],name},checks=[],details={};let preferences,error;
    const check=(name,ok)=>{checks.push({name,ok:!!ok});if(!ok)throw Error(name);};
    const getItem=()=>app.getLoginItemSettings(startup).launchItems.find(item=>item.name===name&&item.scope==='user');
    try{
      check('unique-qa-entry-absent-before-test',query(RUN,name).status!==0&&query(APPROVED,name).status!==0);
      preferences=createDesktopPreferences({directory:profile,app,globalShortcut,getWindow:()=>null,packaged:true,name});preferences.initialize();
      check('module-initialization-leaves-startup-off',!preferences.snapshot().preferences.launchAtLogin&&query(RUN,name).status!==0);
      app.setLoginItemSettings({...startup,openAtLogin:true,enabled:false});
      check('real-windows-entry-registered-but-startup-approved-disabled',app.getLoginItemSettings(startup).openAtLogin===true&&getItem()?.enabled===false);
      check('module-reports-disabled-entry-as-off',preferences.snapshot().preferences.launchAtLogin===false);
      check('unrelated-setting-does-not-enable-windows-entry',preferences.update({startHidden:true,zoomFactor:1.2}).ok&&getItem()?.enabled===false);
      details.beforeEnable=getItem();details.enableResult=preferences.update({launchAtLogin:true});details.afterEnable=getItem();
      check('explicit-enable-reactivates-exact-qa-entry',details.enableResult.ok&&getItem()?.enabled===true&&preferences.snapshot().preferences.launchAtLogin===true);
      app.setLoginItemSettings({...startup,openAtLogin:true,enabled:false});
      fs.mkdirSync(path.join(profile,'desktop-preferences.json.tmp'));
      check('disk-failure-rejects-explicit-enable',preferences.update({launchAtLogin:true}).code==='PREFERENCES_SAVE_FAILED');
      check('disk-failure-restores-real-windows-disabled-state',app.getLoginItemSettings(startup).openAtLogin===true&&getItem()?.enabled===false&&preferences.snapshot().preferences.launchAtLogin===false);
      fs.rmdirSync(path.join(profile,'desktop-preferences.json.tmp'));
      app.setLoginItemSettings({...startup,args:['--different-qa-purpose'],openAtLogin:true,enabled:true});
      check('same-executable-other-arguments-do-not-enable-preference',app.getLoginItemSettings(startup).executableWillLaunchAtLogin===true&&preferences.snapshot().preferences.launchAtLogin===false);
      app.setLoginItemSettings({...startup,name:name+'.Other',openAtLogin:true,enabled:true});
      check('other-name-correct-arguments-cannot-mask-own-wrong-arguments',app.getLoginItemSettings(startup).openAtLogin===false&&preferences.snapshot().preferences.launchAtLogin===false);
      app.setLoginItemSettings({...startup,openAtLogin:false});
      check('only-another-name-registration-cannot-enable-preference',app.getLoginItemSettings(startup).openAtLogin===false&&preferences.snapshot().preferences.launchAtLogin===false);
      app.setLoginItemSettings({...startup,openAtLogin:true,enabled:false});
      check('another-enabled-name-cannot-mask-own-windows-disabled-entry',app.getLoginItemSettings(startup).openAtLogin===true&&app.getLoginItemSettings(startup).executableWillLaunchAtLogin===true&&preferences.snapshot().preferences.launchAtLogin===false);
      app.setLoginItemSettings({...startup,name:name+'.Other',openAtLogin:false});
      check('explicit-enable-then-disable-removes-qa-registration',preferences.update({launchAtLogin:true}).ok&&preferences.update({launchAtLogin:false}).ok&&query(RUN,name).status!==0);
    }catch(caught){error=caught.message;}
    finally{
      preferences?.dispose();app.setLoginItemSettings({...startup,openAtLogin:false});app.setLoginItemSettings({...startup,name:name+'.Other',openAtLogin:false});
      process.stdout.write(prefix+JSON.stringify({ok:!error,error,checkedOn:'2026-10-09',electron:process.versions.electron,scope:'Real Windows API, unique QA Run and StartupApproved values, isolated profile. No user configuration or UI and no physical login/reboot.',checks,details,moduleSHA256:digest(fs.readFileSync(path.join(root,'src/desktop-preferences.cjs')))})+'\n');app.exit(error?1:0);
    }
  }).catch(error=>{process.stdout.write(prefix+JSON.stringify({ok:false,error:error.message})+'\n');app.exit(1);});
}
