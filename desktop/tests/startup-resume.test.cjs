'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createDesktopPreferences}=require('../src/desktop-preferences.cjs');

function fixture(t,{registered=true,enabled=false,packaged=true,items}={}){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'synk-startup-resume-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const executable='C:\\QA\\SYNKPlatformPreview.exe',appRoot='C:\\QA\\desktop',name='im.synk.platform.preview';
  const args=packaged?['--synk-autostart']:[appRoot,'--synk-dev','--client=platform','--synk-autostart'];
  let entries=items|| (registered?[{name,path:executable,args,scope:'user',enabled}]:[]),readFailure=false,ignoreWrite=false;
  const writes=[],registrations=new Set();
  const app={getLoginItemSettings(){if(readFailure)throw Error('Synthetic read failure');return {openAtLogin:entries.some(item=>item.name===name&&item.scope==='user'&&path.win32.normalize(item.path).toLowerCase()===path.win32.normalize(executable).toLowerCase()&&JSON.stringify(item.args)===JSON.stringify(args)),executableWillLaunchAtLogin:entries.some(item=>item.enabled),launchItems:entries.map(item=>({...item,args:item.args.filter(arg=>!arg.startsWith('--'))}))};},setLoginItemSettings(value){writes.push(value);if(ignoreWrite)return;entries=value.openAtLogin?[{name:value.name,path:value.path,args:[...value.args],scope:'user',enabled:value.enabled}]:[];}};
  const preferences=createDesktopPreferences({directory,app,globalShortcut:{register:key=>{registrations.add(key);return true;},unregister:key=>registrations.delete(key)},getWindow:()=>null,platform:'win32',packaged,executable,appRoot,name});
  t.after(()=>preferences.dispose());
  return {directory,preferences,writes,registrations,app,args,setReadFailure:value=>{readFailure=value;},setIgnoreWrite:value=>{ignoreWrite=value;},get entries(){return entries;}};
}

test('Windows-disabled startup stays off at initialization and unrelated settings do not reactivate it',t=>{
  const f=fixture(t);f.preferences.initialize();assert.equal(f.preferences.snapshot().preferences.launchAtLogin,false);assert.equal(f.writes.length,0);
  assert.equal(f.preferences.update({zoomFactor:1.2,startHidden:true}).ok,true);assert.equal(f.writes.length,0);assert.equal(f.entries[0].enabled,false);
});

test('explicit startup enable reactivates the exact packaged registration and readback confirms it',t=>{
  const f=fixture(t);const result=f.preferences.update({launchAtLogin:true});assert.equal(result.ok,true);assert.equal(result.preferences.launchAtLogin,true);
  assert.deepEqual(f.writes,[{path:'C:\\QA\\SYNKPlatformPreview.exe',args:['--synk-autostart'],name:'im.synk.platform.preview',openAtLogin:true,enabled:true}]);
  assert.equal(f.preferences.update({launchAtLogin:false}).ok,true);assert.equal(f.preferences.snapshot().preferences.launchAtLogin,false);assert.equal(f.entries.length,0);
});

test('source launch registration keeps its full development arguments',t=>{
  const f=fixture(t,{registered:false,packaged:false});assert.equal(f.preferences.update({launchAtLogin:true}).ok,true);assert.deepEqual(f.writes[0].args,['C:\\QA\\desktop','--synk-dev','--client=platform','--synk-autostart']);
});

test('only the matching enabled user entry counts, even if another executable launch is enabled',t=>{
  const own={name:'im.synk.platform.preview',path:'C:\\QA\\SYNKPlatformPreview.exe',args:['--synk-autostart'],scope:'user',enabled:false};
  for(const change of [{name:'other'},{path:'C:\\QA\\Other.exe'},{args:[]},{args:['--other']},{scope:'machine'}]){
    const f=fixture(t,{items:[{...own,...change,enabled:true}]});assert.equal(f.preferences.snapshot().preferences.launchAtLogin,false,JSON.stringify(change));
  }
  const anotherEnabled=fixture(t,{items:[own,{...own,name:'other',enabled:true}]});assert.equal(anotherEnabled.preferences.snapshot().preferences.launchAtLogin,false);
  const matching=fixture(t,{items:[{...own,path:'c:/qa/synkplatformpreview.exe',enabled:true}]});assert.equal(matching.preferences.snapshot().preferences.launchAtLogin,true);
});

test('disk failure restores the previous registered-but-Windows-disabled state and releases the new shortcut',t=>{
  const f=fixture(t);fs.mkdirSync(path.join(f.directory,'desktop-preferences.json.tmp'));
  assert.equal(f.preferences.update({launchAtLogin:true,globalShortcut:'Ctrl+Alt+S'}).code,'PREFERENCES_SAVE_FAILED');
  assert.equal(f.writes.length,2);assert.equal(f.writes[1].openAtLogin,true);assert.equal(f.writes[1].enabled,false);assert.equal(f.entries[0].enabled,false);assert.equal(f.registrations.size,0);assert.equal(f.preferences.snapshot().preferences.launchAtLogin,false);
});

test('readback refusal rolls back a failed explicit enable without falsely reporting success',t=>{
  const f=fixture(t);f.setIgnoreWrite(true);assert.equal(f.preferences.update({launchAtLogin:true}).code,'STARTUP_UNAVAILABLE');
  assert.equal(f.writes.length,2);assert.equal(f.writes[1].openAtLogin,true);assert.equal(f.writes[1].enabled,false);assert.equal(fs.existsSync(path.join(f.directory,'desktop-preferences.json')),false);
});

test('readback exception restores the previous disabled registration',t=>{
  const f=fixture(t),write=f.app.setLoginItemSettings;
  f.app.setLoginItemSettings=value=>{write(value);f.setReadFailure(value.enabled);};
  assert.equal(f.preferences.update({launchAtLogin:true}).code,'STARTUP_UNAVAILABLE');assert.equal(f.writes.length,2);assert.equal(f.writes[1].enabled,false);assert.equal(f.entries[0].enabled,false);
});

test('unreadable prior Windows state rejects an explicit change before any OS or disk mutation',t=>{
  const f=fixture(t);f.setReadFailure(true);assert.equal(f.preferences.update({launchAtLogin:true}).code,'STARTUP_UNAVAILABLE');assert.equal(f.writes.length,0);assert.equal(fs.existsSync(path.join(f.directory,'desktop-preferences.json')),false);
});
