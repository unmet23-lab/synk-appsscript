'use strict';
// Read-only production-module audit. Native windows and persistence are isolated;
// display changes are synthetic events, never physical monitor/OS changes.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),prefix='SYNK_WINDOW_RESUME_AUDIT ';
const argument=name=>process.argv.find(value=>value.startsWith('--'+name+'='))?.slice(name.length+3);
const output=path.join(root,'..','docs','_ops','qa','platform-convenience-20261009','window-resume-audit.json');
if(!process.versions.electron){
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'synk-window-resume-audit-'));
  try{
    const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
    const run=require('node:child_process').spawnSync(require('electron'),[__filename,'--profile='+profile],{cwd:root,windowsHide:true,env,encoding:'utf8',timeout:20000});
    const line=run.stdout?.split(/\r?\n/).find(value=>value.startsWith(prefix));
    const report=line?JSON.parse(line.slice(prefix.length)):{completed:false,error:run.error?.message||'NO_RESULT',stderr:run.stderr?.slice(-1500)};
    report.electronExitCode=run.status;fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({completed:report.completed,ok:report.ok,checks:report.checks?.length,findings:report.findings,error:report.error,output},null,2));if(!report.completed||report.ok===false)process.exitCode=1;
  }finally{
    const resolved=path.resolve(profile);if(path.dirname(resolved)!==path.resolve(os.tmpdir())||!path.basename(resolved).startsWith('synk-window-resume-audit-'))throw Error('Unsafe temporary profile');
    fs.rmSync(resolved,{recursive:true,force:true,maxRetries:20,retryDelay:100});
  }
}else{
  const {app,BrowserWindow,screen}=require('electron'),{EventEmitter}=require('node:events');
  const {createWindowPlacement}=require('../src/window-placement.cjs');
  const profile=argument('profile');if(!profile||path.dirname(path.resolve(profile))!==path.resolve(os.tmpdir())||!path.basename(profile).startsWith('synk-window-resume-audit-'))throw Error('Isolated profile required');
  app.enableSandbox();app.setName('SYNK isolated window resume audit');app.setPath('userData',profile);app.setPath('sessionData',path.join(profile,'Session'));app.on('window-all-closed',()=>{});
  app.whenReady().then(async()=>{
    const findings=[],checks=[],windows=[];const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    try{
      // A hidden startup window must retain its pending maximized preference if
      // native move/resize events persist bounds before its first deliberate show.
      const seed={x:100,y:100,width:1100,height:800,maximized:true};
      const maxDirectory=path.join(profile,'pending-maximize');fs.mkdirSync(maxDirectory,{recursive:true});fs.writeFileSync(path.join(maxDirectory,'window-placement.json'),JSON.stringify(seed));
      const placement=createWindowPlacement({directory:maxDirectory,screen}),initial=placement.restore();
      const hidden=new BrowserWindow({x:initial.x,y:initial.y,width:initial.width,height:initial.height,frame:false,show:false,skipTaskbar:true,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});windows.push(hidden);
      placement.attach(hidden,{maximized:initial.maximized});let resizes=0;hidden.on('resize',()=>resizes++);
      hidden.setSize(Math.max(600,initial.width-20),Math.max(400,initial.height-20));await delay(350);
      const persisted=JSON.parse(fs.readFileSync(path.join(maxDirectory,'window-placement.json'),'utf8'));
      checks.push({name:'native-hidden-resize-keeps-window-hidden',ok:!hidden.isVisible(),nativeResizeEvents:resizes});
      findings.push({id:'pending-maximized-state-overwritten',reproduced:resizes>0&&initial.maximized===true&&persisted.maximized===false,before:initial.maximized,after:persisted.maximized,windowVisible:hidden.isVisible(),scope:'Actual hidden Electron BrowserWindow receives native resize. This does not reproduce a physical sleep or monitor event.'});
      checks.push({name:'pending-maximized-state-survives-native-hidden-resize',ok:resizes>0&&initial.maximized===true&&persisted.maximized===true});
      // Synthetic display changes use actual Electron minimum-size/bounds APIs.
      const fakeScreen=new EventEmitter();let display={id:900001,workArea:{x:0,y:0,width:1600,height:1000}};
      fakeScreen.getAllDisplays=()=>[display];fakeScreen.getPrimaryDisplay=()=>display;
      const topology=createWindowPlacement({directory:path.join(profile,'topology'),screen:fakeScreen}),bounds=topology.restore();
      const small=new BrowserWindow({x:bounds.x,y:bounds.y,width:bounds.width,height:bounds.height,minWidth:bounds.minWidth,minHeight:bounds.minHeight,frame:false,show:false,skipTaskbar:true,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});windows.push(small);topology.attach(small);
      display={...display,workArea:{x:0,y:0,width:800,height:560}};fakeScreen.emit('display-metrics-changed',{},display,['workArea','scaleFactor']);await delay(250);
      const eventBounds=small.getBounds(),eventMinimum=small.getMinimumSize();small.setBounds({x:0,y:0,width:800,height:560});await delay(100);
      findings.push({id:'runtime-small-display-minimum-not-updated',reproduced:eventMinimum[0]>800&&eventMinimum[1]>560,displayEventListeners:fakeScreen.listenerCount('display-metrics-changed'),desired:topology.restore(),afterEvent:{bounds:eventBounds,minimum:eventMinimum},afterNativeSetBounds:small.getBounds(),windowVisible:small.isVisible(),scope:'Synthetic display event, actual Electron minimum-size clamp. No physical monitor or DPI change was performed.'});
      checks.push({name:'smaller-display-adjusts-native-minimum-size',ok:eventMinimum[0]===800&&eventMinimum[1]===560});
      checks.push({name:'frameless-normal-window-fits-small-work-area-with-native-dip-rounding',ok:Math.abs(eventBounds.x)<=1&&Math.abs(eventBounds.y)<=1&&Math.abs(eventBounds.width-800)<=1&&Math.abs(eventBounds.height-560)<=1,nativeDipTolerance:1});
      let boundsWrites=0,minimumWrites=0;const setBounds=small.setBounds.bind(small),setMinimumSize=small.setMinimumSize.bind(small);
      small.setBounds=(...args)=>{boundsWrites++;return setBounds(...args);};small.setMinimumSize=(...args)=>{minimumWrites++;return setMinimumSize(...args);};
      small.emit('show');fakeScreen.emit('display-metrics-changed',{},display,['scaleFactor']);await delay(250);
      checks.push({name:'already-fitting-native-window-is-not-repositioned',ok:boundsWrites===0&&minimumWrites===0,boundsWrites,minimumWrites});
      checks.push({name:'both-native-windows-remained-hidden',ok:windows.every(window=>!window.isVisible())});
      for(const window of windows)window.destroy();
      checks.push({name:'destroy-releases-every-screen-listener',ok:['display-added','display-removed','display-metrics-changed'].every(event=>fakeScreen.listenerCount(event)===0)});
      const hash=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'src','window-placement.cjs'))).digest('hex');
      const ok=checks.every(check=>check.ok)&&findings.every(finding=>!finding.reproduced);
      process.stdout.write(prefix+JSON.stringify({completed:true,ok,checkedOn:'2026-10-09',moduleSHA256:hash,checks,findings,scope:'Temporary profile and hidden isolated frameless windows only. Display changes are synthetic events; no live app, user profile, login, display settings, suspend, or restart touched.'})+'\n');app.exit(ok?0:1);
    }catch(error){for(const window of windows)if(!window.isDestroyed())window.destroy();process.stdout.write(prefix+JSON.stringify({completed:false,error:error.message,checks,findings})+'\n');app.exit(1);}
  });
}
