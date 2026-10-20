import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {installationEnvironment,installationGuide,devicePermissionTimeout} from './public/pulse-app/install.mjs';
import {deviceAvailability} from './public/pulse-app/push.mjs';
import {header,dialogContent,projectView} from './public/pulse-app/views.mjs';
import {createDemoSession} from './public/pulse-app/demo.mjs';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {createCompanyApp} from './server.mjs';

const chrome='Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36';
const samsung=chrome.replace('Chrome/130.0.0.0','SamsungBrowser/27.0 Chrome/125.0.0.0');
const iphone='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
// The PULSE window of the SYNK PC app (Electron 44, product name 「SYNK Platform」).
const pcApp='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) SYNKPlatform/0.4.34 Chrome/152.0.7977.130 Electron/44.5.1 Safari/537.36';
const supported={secure:true,serviceWorker:true,pushManager:true,notification:true,permission:'default'};

test('installation helper is served as JavaScript before customer authentication',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'synk-pulse-install-'));
  const app=createCompanyApp({dataDir:directory,host:'127.0.0.1',port:0,origin:'https://pulse-install.example.test',allowTestHost:true,schedule:false,backgroundJobsEnabled:false,workNotificationsEnabled:false,webPushEnabled:false,synkIdentityConfig:null,synkCustomerIdentityConfig:null,teachingConfig:null});
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  const address=await app.start(),base='http://127.0.0.1:'+address.port;
  const response=await fetch(base+'/pulse-app/install.mjs');
  assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/^text\/javascript/);
  assert.equal(await response.text(),await readFile(new URL('./public/pulse-app/install.mjs',import.meta.url),'utf8'));
  assert.equal((await fetch(base+'/pulse/api/project')).status,401);
});

test('Galaxy Chrome and Samsung instructions preserve browser-specific installation paths',()=>{
  const android=installationEnvironment({userAgent:chrome});
  assert.equal(android.android,true);assert.equal(android.browser,'chrome');assert.equal(android.embedded,false);
  assert.equal(installationGuide(android,{canPrompt:true}).canPrompt,true);
  assert.match(installationGuide(android).steps.join(' '),/설치 및 바로가기/);
  const internet=installationEnvironment({userAgent:samsung});
  assert.equal(internet.browser,'samsung');assert.match(installationGuide(internet).steps.join(' '),/주소창 설치 아이콘/);
});

test('iPhone and desktop-mode iPad always explain home-screen installation, not a missing browser prompt',()=>{
  const ios=installationEnvironment({userAgent:iphone});
  const ipad=installationEnvironment({userAgent:'Mozilla/5.0 Macintosh Safari/605.1.15',platform:'MacIntel',maxTouchPoints:5});
  for(const env of [ios,ipad]){
    assert.equal(env.ios,true);
    const guide=installationGuide(env,{connected:true,canPrompt:true});
    assert.equal(guide.canPrompt,false);assert.equal(guide.openNotifications,false);assert.equal(guide.needsHomeScreen,true);
    assert.match(guide.steps.join(' '),/홈 화면에 추가/);assert.match(guide.notes.join(' '),/16\.4/);
    assert.match(guide.notes.join(' '),/초대 링크를 첫 화면에 붙여/);
  }
});

test('standalone apps skip installation and require a project connection before notifications',()=>{
  const env=installationEnvironment({userAgent:iphone,standalone:true});
  const disconnected=installationGuide(env,{canPrompt:true});
  assert.equal(disconnected.canPrompt,false);assert.equal(disconnected.openNotifications,false);
  assert.match(disconnected.steps[0],/초대 링크/);
  const connected=installationGuide(env,{connected:true,enabled:true});
  assert.equal(connected.openNotifications,true);assert.equal(connected.needsHomeScreen,false);
  assert.match(connected.summary,/알림 연결이 켜져/);assert.doesNotMatch(connected.summary,/도착|수신 완료/);
});

test('messenger and Android webview guides use the original invitation without copying sanitized current URLs',()=>{
  for(const userAgent of [chrome+' KAKAOTALK 10.0',chrome+' Instagram 200.0',chrome.replace('SM-S918B)','SM-S918B; wv)')]){
    const env=installationEnvironment({userAgent});assert.equal(env.embedded,true);
    const guide=installationGuide(env,{connected:true,canPrompt:true});
    assert.equal(guide.canPrompt,false);assert.equal(guide.openNotifications,false);
    assert.match(guide.steps.join(' '),/원본 초대 링크/);assert.match(guide.notes.join(' '),/현재 주소/);
  }
});

test('the guide does not infer browser installation merely from notification permission',()=>{
  const env=installationEnvironment({userAgent:chrome});
  const guide=installationGuide(env,{connected:true,enabled:true,canPrompt:false});
  assert.equal(guide.canPrompt,false);assert.equal(guide.openNotifications,true);
  assert.match(guide.steps[0],/Chrome 메뉴/);
  assert.match(guide.notes.join(' '),/설치한 앱에서도/);
});

test('insecure pages never offer an installation or permission action',()=>{
  const env=installationEnvironment({userAgent:chrome,secure:false});
  const guide=installationGuide(env,{connected:true,canPrompt:true});
  assert.equal(guide.canPrompt,false);assert.equal(guide.openNotifications,false);
  assert.match(guide.steps[0],/https:\/\//);
});

test('mobile blocked and missing permissions point to the appropriate OS or browser setting',()=>{
  assert.equal(deviceAvailability({...supported,android:true}),'');
  assert.equal(deviceAvailability({...supported,ios:true,standalone:true}),'');
  assert.match(deviceAvailability({...supported,android:true,permission:'denied'}),/휴대폰 설정/);
  assert.match(deviceAvailability({...supported,ios:true,standalone:true,permission:'denied'}),/기기 설정 → 알림 → PULSE/);
  assert.match(deviceAvailability({...supported,android:true,pushManager:false}),/삼성 인터넷/);
  assert.match(deviceAvailability({...supported,ios:true,standalone:true,pushManager:false}),/16\.4/);
  assert.match(deviceAvailability({...supported,embedded:true}),/메신저 안 브라우저/);
});

test('permission timeouts retain actionable instructions on each mobile platform',()=>{
  assert.match(devicePermissionTimeout({android:true}),/삼성 인터넷/);
  assert.match(devicePermissionTimeout({ios:true}),/홈 화면의 PULSE/);
  assert.match(devicePermissionTimeout(),/Chrome 또는 Edge/);
});

test('customer and creator headers expose installation help without a browser install event',()=>{
  for(const state of [{mode:'customer',project:null},{mode:'customer',project:{id:'project'}},{mode:'staff',user:null},{mode:'staff',user:{name:'제작자'}}]){
    const html=header({...state,installPrompt:null});
    assert.match(html,/<button[^>]+data-action="install"[^>]*>앱 설치 · 알림<\/button>/);
    assert.equal((html.match(/data-action="install"/g)||[]).length,1);
  }
});

test('installation dialogs render only supported actions and escape every guide field',()=>{
  const android=installationEnvironment({userAgent:chrome});
  const ready=dialogContent('install',{guide:installationGuide(android,{connected:true,canPrompt:true})});
  assert.match(ready,/data-action="install-now"/);assert.match(ready,/data-action="install-notifications"/);
  const ios=dialogContent('install',{guide:installationGuide(installationEnvironment({userAgent:iphone}),{connected:true,canPrompt:true})});
  assert.doesNotMatch(ios,/data-action="install-now"|data-action="install-notifications"/);assert.match(ios,/홈 화면에 추가/);
  const untrusted='<img src=x onerror=alert(1)>';
  const html=dialogContent('install',{guide:{title:untrusted,summary:untrusted,steps:[untrusted],notes:[untrusted],canPrompt:false,openNotifications:false}});
  assert.doesNotMatch(html,/<img|onerror="/);assert.equal((html.match(/&lt;img/g)||[]).length,4);
  assert.match(html,/data-action="close-dialog"/);
});

test('the PC app window is recognized from its Electron user agent and its header has no installation help',()=>{
  const windows=installationEnvironment({userAgent:pcApp,platform:'Win32'});
  assert.equal(windows.desktopApp,true);assert.equal(windows.embedded,false);assert.equal(windows.mobile,false);
  const mac=installationEnvironment({userAgent:pcApp.replace('Windows NT 10.0; Win64; x64','Macintosh; Intel Mac OS X 10_15_7'),platform:'MacIntel'});
  assert.equal(mac.desktopApp,true);assert.equal(mac.ios,false);
  const desktopChrome='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
  for(const userAgent of [desktopChrome,desktopChrome+' Edg/141.0.0.0',chrome,samsung,iphone,'',undefined])assert.equal(installationEnvironment({userAgent}).desktopApp,false);
  for(const state of [{mode:'customer',project:null},{mode:'customer',project:{id:'project'}}]){
    const html=header({...state,desktopApp:true,live:{}});
    assert.doesNotMatch(html,/data-action="install"|앱 설치/);
    assert.match(html,state.project?/data-action="notifications"/:/제작자 공간/);
  }
  const demo=header({mode:'customer',demo:true,desktopApp:true});
  assert.match(demo,/체험 나가기/);assert.doesNotMatch(demo,/data-action="install"/);
});

test('the app records the PC app window before its first render and hands it to the device check',async()=>{
  const app=await readFile(new URL('./public/pulse-app/app.mjs',import.meta.url),'utf8'),install=await readFile(new URL('./public/pulse-app/install.mjs',import.meta.url),'utf8');
  // The app's top level reads the same marker as installationEnvironment without calling an import (vm tests strip imports).
  const marker=install.match(/const desktopApp=(\/.+?\/)\.test\(userAgent\);/)?.[1];
  assert.equal(marker,'/\\bElectron\\//');
  const flag=app.indexOf(`s.desktopApp=${marker}.test(navigator.userAgent||'');`);
  assert.ok(flag>0&&flag<app.indexOf("if(demo){accept(demo.snapshot());"),'the flag is set before the boot render');
  assert.match(app,/function pushSupport\(\)\{return deviceAvailability\(\{\.\.\.installEnvironment\(\),/);
  assert.match(app,/초대 링크 없이 \$\{s\.desktopApp\?'이 PC 앱':'이 브라우저'\}에서 열려요/);
});

// The PC app opens the demo (?demo=coffee) inside its own window too, so the demo names that window as 「이 PC 앱」.
const memoryStorage=()=>{const memory=new Map();return {getItem:key=>memory.get(key)??null,setItem:(key,value)=>{memory.set(key,String(value));},removeItem:key=>{memory.delete(key);}};};

test('the demo guide says the record stays in this PC app inside the PC app window and in this browser elsewhere',()=>{
  const session=createDemoSession({storage:memoryStorage()}),guide=session.guide();
  const note=extra=>projectView({mode:'customer',demo:true,demoGuide:guide,project:session.snapshot().project,tab:guide.tab,...extra}).match(/<p class="demo-storage-note">([^<]*)<\/p>/)?.[1];
  assert.equal(note({desktopApp:true,demoPersistent:true}),'체험 기록은 이 PC 앱에만 남고, 실제 의뢰나 승인으로 이어지지 않아요.');
  assert.equal(note({desktopApp:true,demoPersistent:false}),'이 PC 앱에서는 체험 기록을 저장할 수 없어 창을 닫으면 사라져요. 실제 의뢰나 승인으로 이어지지 않아요.');
  assert.equal(note({demoPersistent:true}),'체험 기록은 이 브라우저에만 남고, 실제 의뢰나 승인으로 이어지지 않아요.');
  assert.equal(note({demoPersistent:false}),'체험 기록을 저장할 수 없는 브라우저라 창을 닫으면 사라져요. 실제 의뢰나 승인으로 이어지지 않아요.');
});

// Runs app.mjs the way the vm tests do (imports stripped, stopped before the boot line) but keeps the demo, so the
// window flag comes from the real user agent line and the reset question is the one the router opens.
async function demoApp(userAgent){
  const listeners={},dialogs=[];
  const element=()=>({innerHTML:'',hidden:false,open:false,className:'',dataset:{},classList:{toggle(){}},querySelector:()=>null,querySelectorAll:()=>[],contains:()=>false,setAttribute(){},addEventListener(){},close(){this.open=false;},showModal(){this.open=true;}});
  const nodes=new Map(['#main','#app-dialog','#notice','#header-actions','#pulse-live','#connection-banner'].map(key=>[key,element()]));
  const context=vm.createContext({createDemoSession,storage:memoryStorage(),productionUI:()=>({submit:()=>false,click:()=>false,render(){},reset(){}}),dialogContent:(type,item)=>{dialogs.push({type,item});return '';},URL,URLSearchParams,Map,Set,WeakSet,Date,Intl,Number,JSON,Object,Array,String,Promise,console,setTimeout:()=>1,clearTimeout(){},location:new URL('https://workspace.synk.im/pulse-app/?demo=coffee'),history:{replaceState(){}},navigator:{onLine:true,userAgent},window:{addEventListener(){},isSecureContext:true},document:{visibilityState:'visible',documentElement:{classList:{toggle(){}}},querySelector:key=>nodes.get(key)||null,querySelectorAll:()=>[],addEventListener(name,fn){(listeners[name]||=[]).push(fn);}}});
  const app=await readFile(new URL('./public/pulse-app/app.mjs',import.meta.url),'utf8');
  const demoLine="const demo=demoMode?(await import('./demo.mjs')).createDemoSession():null;",boot=app.indexOf("if(demo){accept(demo.snapshot());");
  assert.ok(app.includes(demoLine)&&boot>0,'the demo import and the boot line are where this test expects them');
  vm.runInContext(app.slice(0,boot).replace(/^import .*\r?\n/gm,'').replace(demoLine,'const demo=demoMode?createDemoSession({storage}):null;'),context);
  return {flag:vm.runInContext('s.desktopApp',context),dialogs,click:async action=>{await listeners.click[0]({target:{closest:()=>({disabled:false,dataset:{action}})}});}};
}

test('the demo reset question names this PC app inside the PC app window and this browser elsewhere',async()=>{
  const desktopChrome='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
  for(const [userAgent,desktopApp,where] of [[pcApp,true,'이 PC 앱'],[desktopChrome,false,'이 브라우저'],[iphone,false,'이 브라우저']]){
    const app=await demoApp(userAgent);
    assert.equal(app.flag,desktopApp);
    await app.click('demo-reset');
    assert.deepEqual(app.dialogs.map(dialog=>dialog.type),['confirm']);
    assert.equal(app.dialogs[0].item.text,`${where}에 남은 체험 기록(고른 것·의견·승인)만 지워요. 실제 프로젝트에는 영향이 없어요.`);
  }
});
