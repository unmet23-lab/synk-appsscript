'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{EventEmitter}=require('node:events');
const {createMacApplicationLocationGate}=require('../src/mac-application-location.cjs');
function fixture({platform='darwin',packaged=true,smoke=false,inside=false,choice=0,replace=0,conflict=null,moved=true,throwMove=false,throwLocation=false,exists=false,requiresAuthorization=false}={}){
  const dialogs=[],calls=[];
  const app={isPackaged:packaged,getName:()=> 'SYNK Platform Preview',isInApplicationsFolder(){calls.push('location');if(throwLocation)throw Error('private path');return inside;},moveToApplicationsFolder(options){calls.push('move');if(throwMove)throw Error('private path');if(conflict&&!options.conflictHandler(conflict))return false;return moved;},setPath(){throw Error('Profile mutation forbidden');},getPath(){throw Error('Profile access forbidden');},quit(){throw Error('Electron owns successful move quit');},relaunch(){throw Error('Electron owns successful move relaunch');}};
  const dialog={async showMessageBox(options){dialogs.push(options);return {response:options.type==='question'?choice:0};},showMessageBoxSync(options){dialogs.push(options);return replace;}};
  return {gate:createMacApplicationLocationGate({app,dialog,platform,packaged,smoke,inspectDestination:()=>({exists,requiresAuthorization})}),app,dialog,dialogs,calls};
}
test('only packaged non-smoke Mac applications inspect their location',async()=>{
  for(const options of [{platform:'win32'},{platform:'linux'},{packaged:false},{smoke:true}]){const f=fixture(options);assert.equal((await f.gate.run()).status,'not-required');assert.deepEqual(f.calls,[]);assert.equal(f.dialogs.length,0);}
  const f=fixture({inside:true});assert.deepEqual(await f.gate.run(),{continueStartup:true,status:'in-applications'});assert.deepEqual(f.calls,['location']);assert.equal(f.dialogs.length,0);
});
test('successful move leaves quit/relaunch to Electron and never initializes the old copy',async()=>{
  const f=fixture();assert.deepEqual(await f.gate.run(),{continueStartup:false,status:'moving'});assert.deepEqual(f.calls,['location','move']);assert.equal(f.dialogs.length,1);assert.equal(f.dialogs[0].cancelId,1);
});
test('declining the initial proposal opens the same copy with an update-location warning',async()=>{
  const f=fixture({choice:1});assert.deepEqual(await f.gate.run(),{continueStartup:true,status:'declined'});assert.deepEqual(f.calls,['location']);assert.equal(f.dialogs.length,2);assert.match(f.dialogs[1].message,/업데이트/);assert.match(f.dialogs[1].detail,/기록은 그대로/);
});
test('an existing app is never replaced without a separate explicit confirmation',async()=>{
  for(const replace of [0,1]){const f=fixture({conflict:'exists',replace});const result=await f.gate.run();assert.equal(result.continueStartup,replace===0);assert.equal(result.status,replace===0?'replacement-declined':'moving');const prompt=f.dialogs[1];assert.equal(prompt.defaultId,0);assert.equal(prompt.cancelId,0);assert.match(prompt.detail,/교체/);}
});
test('replacement is confirmed before the native API even when its privileged path bypasses conflictHandler',async()=>{
  const declined=fixture({exists:true});assert.equal((await declined.gate.run()).status,'replacement-declined');assert.deepEqual(declined.calls,['location']);
  const approved=fixture({exists:true,replace:1});assert.equal((await approved.gate.run()).status,'moving');assert.deepEqual(approved.calls,['location','move']);assert.equal(approved.dialogs.length,2);
  const callback=fixture({exists:true,replace:1,conflict:'exists'});assert.equal((await callback.gate.run()).status,'moving');assert.equal(callback.dialogs.length,2,'native conflict does not ask twice');
});
test('a protected Applications directory or target never enters Electron\'s unguarded administrator path',async()=>{
  for(const exists of [false,true]){const f=fixture({exists,requiresAuthorization:true,replace:1});assert.equal((await f.gate.run()).status,'manual-permission');assert.deepEqual(f.calls,['location']);assert.match(f.dialogs.at(-1).detail,/Finder/);}
});
test('a running same-name app is retained instead of silently activating an older version',async()=>{
  const f=fixture({conflict:'existsAndRunning',replace:1});assert.deepEqual(await f.gate.run(),{continueStartup:true,status:'running-conflict'});assert.equal(f.dialogs.length,2);assert.match(f.dialogs[1].detail,/완전히 종료/);
});
test('cancelled authorization, unknown conflicts, API and copy failures continue with a safe warning',async()=>{
  for(const [options,status] of [[{moved:false},'move-cancelled'],[{conflict:'unexpected'},'move-failed'],[{throwMove:true},'move-failed'],[{throwLocation:true},'location-unavailable']]){const f=fixture(options);assert.deepEqual(await f.gate.run(),{continueStartup:true,status});assert.equal(f.dialogs.at(-1).type,'warning');assert.doesNotMatch(JSON.stringify(f.dialogs),/private path/);}
});
test('one process presents one proposal even when activation and startup race',async()=>{
  const f=fixture({choice:1});let resolve;f.dialog.showMessageBox=options=>{f.dialogs.push(options);return options.type==='question'?new Promise(done=>{resolve=done;}):Promise.resolve({response:0});};
  const first=f.gate.run(),second=f.gate.run();assert.equal(first,second);assert.equal(f.dialogs.length,1);resolve({response:1});await first;assert.equal(await f.gate.run(),await first);assert.equal(f.dialogs.length,2);
});
test('the actual common entry point gates Platform, WORLD and Workspace before update or account initialization',async()=>{
  const source=fs.readFileSync(path.join(__dirname,'../src/main.cjs'),'utf8'),body=source.slice(source.indexOf('if(!app.requestSingleInstanceLock())'),source.indexOf('function showPlatformMain()'));
  for(const clientId of ['platform','world','messenger'])for(const move of [false,true]){
    let resolve;const f=fixture(),app=Object.assign(new EventEmitter(),f.app,{getPath:()=>'/synthetic-profile',getVersion:()=> '0.4.11',requestSingleInstanceLock:()=>true,whenReady:()=>Promise.resolve()}),calls=[];
    f.dialog.showMessageBox=options=>options.type==='question'?new Promise(done=>{resolve=done;}):Promise.resolve({response:0});
    const context={app,path,process:{platform:'darwin',arch:'arm64',argv:[]},runtime:{clientId},packaged:true,smoke:false,quittingRequested:false,appLocationReady:false,appLocation:createMacApplicationLocationGate({app,dialog:f.dialog,platform:'darwin',inspectDestination:()=>({exists:false,requiresAuthorization:false})}),startupAllowed:clientId!=='platform',platformTray:null,desktopPreferences:null,window:null,connectionRecovery:null,createPlatformUpdater:()=>{calls.push('updater');return {snapshot:()=>({state:'disabled'})};},beginPlatformStartup:async()=>calls.push('startup'),initializeMain:()=>calls.push('initialize'),createWindow:()=>calls.push('window'),requestPlatformWindow:()=>calls.push('reveal'),sendTeachingView(){}};
    vm.runInNewContext(body,context);await Promise.resolve();app.emit('activate');app.emit('second-instance');assert.deepEqual(calls,[]);resolve({response:move?0:1});await new Promise(done=>setImmediate(done));assert.deepEqual(calls,move?[]:clientId==='platform'?['updater','startup']:['initialize']);if(move){app.emit('activate');app.emit('second-instance');assert.deepEqual(calls,[]);}
  }
});
