'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {createDesktopPreferences}=require('../src/desktop-preferences.cjs');
const {validPatch}=require('../src/care-notifications.cjs');

function fixture(t,{registered=true,enabled=false,packaged=true,items,saved,executable='C:\\QA\\SYNKPlatformPreview.exe'}={}){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'synk-startup-resume-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  if(saved)fs.writeFileSync(path.join(directory,'desktop-preferences.json'),JSON.stringify(saved));
  const name='im.synk.platform.preview',args=['--synk-autostart'];
  let entries=items|| (registered?[{name,path:executable,args,scope:'user',enabled}]:[]),readFailure=false,ignoreWrite=false,reads=0;
  const writes=[],registrations=new Set();
  // Like Electron, openAtLogin compares the Run value of the requested name with the requested command.
  const app={getLoginItemSettings(options){reads++;if(readFailure)throw Error('Synthetic read failure');return {openAtLogin:entries.some(item=>item.name===options.name&&item.scope==='user'&&path.win32.normalize(item.path).toLowerCase()===path.win32.normalize(options.path).toLowerCase()&&JSON.stringify(item.args)===JSON.stringify(options.args)),executableWillLaunchAtLogin:entries.some(item=>item.enabled),launchItems:entries.map(item=>({...item,args:item.args.filter(arg=>!arg.startsWith('--'))}))};},setLoginItemSettings(value){writes.push(value);if(ignoreWrite)return;entries=value.openAtLogin?[{name:value.name,path:value.path,args:[...value.args],scope:'user',enabled:value.enabled}]:[];}};
  const preferences=createDesktopPreferences({directory,app,globalShortcut:{register:key=>{registrations.add(key);return true;},unregister:key=>registrations.delete(key)},getWindow:()=>null,platform:'win32',packaged,executable,name});
  t.after(()=>preferences.dispose());
  return {directory,preferences,writes,registrations,app,args,setReadFailure:value=>{readFailure=value;},setIgnoreWrite:value=>{ignoreWrite=value;},get entries(){return entries;},get reads(){return reads;}};
}
const stored=f=>JSON.parse(fs.readFileSync(path.join(f.directory,'desktop-preferences.json'),'utf8'));
// `electron desktop --synk-dev` has the installed Preview build's Run value name and profile.
const installed={name:'im.synk.platform.preview',path:'C:\\QA\\SYNKPlatformPreview.exe',args:['--synk-autostart'],scope:'user',enabled:true};
const sourceRun=options=>({packaged:false,executable:'C:\\QA\\desktop\\node_modules\\electron\\dist\\electron.exe',items:[{...installed}],...options});

test('Windows-disabled startup stays off at initialization and unrelated settings do not reactivate it',t=>{
  const f=fixture(t);f.preferences.initialize();assert.equal(f.preferences.snapshot().preferences.launchAtLogin,false);assert.equal(f.writes.length,0);
  assert.equal(f.preferences.update({zoomFactor:1.2,startHidden:true}).ok,true);assert.equal(f.writes.length,0);assert.equal(f.entries[0].enabled,false);
});

test('explicit startup enable reactivates the exact packaged registration and readback confirms it',t=>{
  const f=fixture(t);const result=f.preferences.update({launchAtLogin:true});assert.equal(result.ok,true);assert.equal(result.preferences.launchAtLogin,true);
  assert.deepEqual(f.writes,[{path:'C:\\QA\\SYNKPlatformPreview.exe',args:['--synk-autostart'],name:'im.synk.platform.preview',openAtLogin:true,enabled:true}]);
  assert.equal(f.preferences.update({launchAtLogin:false}).ok,true);assert.equal(f.preferences.snapshot().preferences.launchAtLogin,false);assert.equal(f.entries.length,0);
});

test('a source run never reads, replaces or deletes the installed Preview login item',t=>{
  const f=fixture(t,sourceRun({saved:{launchAtLogin:true,closeToTray:false}}));f.preferences.initialize();
  assert.equal(f.preferences.snapshot().capabilities.launchAtLogin,false);
  for(const launchAtLogin of [false,true])assert.equal(f.preferences.update({launchAtLogin,closeToTray:true}).code,'DESKTOP_UNAVAILABLE');
  assert.equal(f.preferences.update({closeToTray:true,startHidden:true}).ok,true);
  assert.equal(f.reads,0);assert.deepEqual(f.writes,[]);assert.deepEqual(f.entries,[installed]);
  assert.deepEqual(stored(f),{closeToTray:true,launchAtLogin:true,startHidden:true,globalShortcut:'',zoomFactor:1});
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

// Run the shipped Care opt-in from main.cjs, including its rollback, against the real preferences module.
const mainSource=fs.readFileSync(path.join(__dirname,'../src/main.cjs'),'utf8');
const careStart=mainSource.indexOf('let careConfiguration='),careEnd=mainSource.indexOf('async function openAccountSignUp(',careStart);
assert.ok(careStart>=0&&careEnd>careStart,'the actual main Care opt-in must be exercised');
const careSource=mainSource.slice(careStart,careEnd);
function enableCare(preferences,configured){
  const member={signedIn:true,status:'signed-in',sessionGeneration:1,account:{synk_user_id:'synthetic-member'}};
  const context={accountStatus:()=>member,runtime:{clientId:'platform'},smoke:false,validCareNotificationPatch:validPatch,desktopPreferences:preferences,
    careNotifications:{status:async()=>({ok:true,available:true,signedIn:true}),configure:async()=>configured}};
  vm.createContext(context);vm.runInContext(careSource,context,{filename:'desktop/src/main.cjs'});
  return context.configureCareNotifications({enabled:true});
}

test('Care alerts in a source run keep the tray and never touch the installed login item, even when rolled back',async t=>{
  for(const saved of [{closeToTray:false},{closeToTray:false,launchAtLogin:true}])for(const configured of [{ok:true,enabled:true},{ok:false,code:'NOTIFICATION_STORAGE_FAILED'}]){
    const f=fixture(t,sourceRun({saved})),result=await enableCare(f.preferences,configured);
    assert.equal(f.reads,0);assert.deepEqual(f.writes,[]);assert.deepEqual(f.entries,[installed]);assert.equal(result,configured);
    assert.deepEqual(stored(f),{closeToTray:configured.ok,launchAtLogin:saved.launchAtLogin===true,startHidden:false,globalShortcut:'',zoomFactor:1});
  }
});

test('Care alerts in the installed app still enable Windows startup and roll it back when saving fails',async t=>{
  const enable={path:'C:\\QA\\SYNKPlatformPreview.exe',args:['--synk-autostart'],name:'im.synk.platform.preview',openAtLogin:true,enabled:true};
  for(const configured of [{ok:true,enabled:true},{ok:false,code:'NOTIFICATION_STORAGE_FAILED'}]){
    const f=fixture(t,{registered:false,saved:{closeToTray:false}}),result=await enableCare(f.preferences,configured);
    assert.equal(result,configured);assert.deepEqual(f.writes,configured.ok?[enable]:[enable,{...enable,openAtLogin:false,enabled:false}]);
    assert.deepEqual(stored(f),{closeToTray:configured.ok,launchAtLogin:configured.ok,startHidden:configured.ok,globalShortcut:'',zoomFactor:1});
  }
});
