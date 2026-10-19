'use strict';
// 소스 실행(electron desktop --synk-dev, 패키징 안 됨)과 설치된 앱(패키징)이 Electron에 넘기는 앱 이름(트레이 툴팁·창 제목)·저장 폴더·
// 단일 실행 잠금·작업 표시줄 ID·세션 파티션·토큰 금고·Suite 선택 폴더를 대조한다. main.cjs·product-main.cjs·teacher-main.cjs 원문을 vm에서 돌리고 Electron·인증·Suite
// 저장은 넘겨받은 값만 기록하는 가짜로 바꾼다. 실제 앱·프로필·레지스트리는 건드리지 않는다(경로 뿌리는 이 시험이 만든 빈 임시 폴더다).
const {test,after}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm'),{EventEmitter}=require('node:events');
const {CLIENTS,DEV_URLS,PLATFORM_ENTRY,identity,sourceScope}=require('../src/catalog.cjs');
const {configuration}=require('../src/auth-config.cjs');
const {suiteKey}=require('../src/suite-session.cjs');

const SRC=path.join(__dirname,'../src');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'synk-source-profile-'));
after(()=>fs.rmSync(root,{recursive:true,force:true}));
const appData=path.join(root,'Roaming'),appPath=path.join(root,'app'),authFile=path.join(root,'auth-config.json');
const AUTH_IDS=['platform','world','messenger','teacher','care','fortune','path'];
const raw={version:1,supabaseUrl:'https://synthetic.invalid',supabasePublishableKey:'sb_publishable_synthetic',clients:Object.fromEntries(AUTH_IDS.map((id,i)=>[id,{clientId:id+'-synthetic',redirectUri:`http://127.0.0.1:${43900+i}/synk/oauth/${id}/callback`}]))};
const RELEASE_ENTRIES={platform:PLATFORM_ENTRY,world:'https://synk.im/world/',messenger:'https://workspace.synk.im/?tab=messenger'};
// 설치 앱의 정식 appId·제품 이름·실행 이름. 이 값이 바뀌면 설치 앱의 로그인·설정·Care 알림 설정이 사라진다.
const INSTALLED={platform:['im.synk.platform','SYNK Platform','SYNKPlatform'],world:['im.synk.world','SYNK WORLD','SYNKWorld'],messenger:['im.synk.messenger','SYNK Workspace','SYNKMessenger']};
const profile=scope=>path.join(appData,'SYNK Desktop',scope);
const suiteFolder=(folder,id,mode)=>path.join(appData,'SYNK Desktop','Suite',folder,suiteKey(configuration(raw,id,mode),mode));
const inside=(parent,child)=>{const relative=path.relative(parent,child);return relative===''||!relative.startsWith('..')&&!path.isAbsolute(relative);};
async function settle(done){for(let i=0;i<50&&!done();i++)await new Promise(resolve=>setImmediate(resolve));assert.ok(done(),'the entry point must reach its window');}

function electronApp({packaged,seen,paths}){
  return Object.assign(new EventEmitter(),{isPackaged:packaged,enableSandbox(){},setName:name=>seen.names.push(name),quit(){},exit(){},
    setPath(name,value){paths[name]=value;},
    getPath(name){assert.ok(Object.hasOwn(paths,name),'unexpected Electron path '+name);return paths[name];},
    getAppPath:()=>appPath,getVersion:()=> '0.4.0',getLoginItemSettings:()=>({openAtLogin:false}),
    setLoginItemSettings(){assert.fail('startup must not write a Windows login item');},
    setAppUserModelId:id=>seen.appUserModelIds.push(id),
    // Electron은 이 호출 순간의 userData 폴더로 단일 실행 잠금을 잡는다.
    requestSingleInstanceLock:()=>{seen.locks.push(paths.userData);return true;},
    whenReady:()=>Promise.resolve()});
}
const record=()=>({names:[],titles:[],trays:[],locks:[],appUserModelIds:[],partitions:[],tokenStores:[],suites:[]});
const fakeSession=()=>({setPermissionRequestHandler(){},setPermissionCheckHandler(){},webRequest:{onBeforeRequest(){},onHeadersReceived(){}},removeAllListeners(){},on(){},protocol:{handle(){}}});
function recordingStubs(seen,electron){
  return {electron,
    './auth-config-path.cjs':{resolveAuthConfigPath:()=>authFile},
    './auth-store.cjs':{createTokenStore:options=>{seen.tokenStores.push({directory:options.directory,scope:options.scope});return {available:()=>false};}},
    './auth-service.cjs':{createAuthService:()=>({initialize:async()=>{},status:()=>({configured:true,signedIn:false,status:'signed-out'}),signIn:async()=>{},signOut:async()=>{},cancel:async()=>{},accountRequest:async()=>{throw Error('No account request allowed');},dispose(){}}),publicError:()=>({code:'SYNTHETIC'})},
    './suite-session.cjs':{suiteKey,createSuiteStore:options=>{seen.suites.push(options.directory);return {};},createSuitePublisher:()=>({initialize:async()=>{},project:state=>state,refresh:()=>true,publish(){},signOut:()=>true,dispose(){}}),createSuiteFollower:()=>({start:async()=>{},dispose(){}})},
  };
}
function run(file,{stubs,process}){
  const filename=path.join(SRC,file);
  vm.runInNewContext(fs.readFileSync(filename,'utf8'),{require:id=>Object.hasOwn(stubs,id)?stubs[id]:id.startsWith('./')?require(path.join(SRC,id)):require(id),__dirname:SRC,process,console,Buffer,setTimeout,clearTimeout},{filename});
}

async function runMain({packaged,clientId,mode='development',argv=[]}){
  const seen=record(),handlers=new Map(),paths={appData,home:path.join(root,'Home'),temp:path.join(root,'Temp'),downloads:path.join(root,'Downloads')};
  const entry=mode==='release'?RELEASE_ENTRIES[clientId]:DEV_URLS[clientId],runtime={clientId,mode,entry,auth:raw},frame={url:entry};
  const app=electronApp({packaged,seen,paths}),contents=Object.assign(new EventEmitter(),{mainFrame:frame,getURL:()=>frame.url,setWindowOpenHandler(){},setZoomFactor(){},send(){}});
  class Window extends EventEmitter{constructor(options){super();this.options=options;this.webContents=contents;seen.titles.push(options.title);}isDestroyed(){return false;}isMinimized(){return false;}isMaximized(){return false;}isVisible(){return false;}getNormalBounds(){return {x:0,y:0,width:this.options.width,height:this.options.height};}show(){}focus(){}}
  // 트레이는 둘이 같이 켜졌을 때 사람이 고르는 곳이라 툴팁 글자를 기록한다.
  class Tray extends EventEmitter{setToolTip(text){seen.trays.push(text);}setContextMenu(){}isDestroyed(){return false;}destroy(){}}
  const session=fakeSession(),display={workArea:{x:0,y:0,width:1920,height:1080}};
  const electron={app,BrowserWindow:Window,Tray,ipcMain:{removeHandler(){},handle:(name,handler)=>handlers.set(name,handler)},session:{fromPartition:name=>{seen.partitions.push(name);return session;}},protocol:{registerSchemesAsPrivileged(){}},Menu:{setApplicationMenu(){},buildFromTemplate:template=>({template})},shell:{openExternal:async()=>{throw Error('No browser allowed');}},dialog:{},safeStorage:{isEncryptionAvailable:()=>false},screen:{getAllDisplays:()=>[display],getPrimaryDisplay:()=>display},globalShortcut:{register:()=>false,unregister(){}},clipboard:{writeText(){throw Error('No clipboard allowed');}}};
  const stubs={...recordingStubs(seen,electron),
    'node:fs':{readFileSync:file=>{if(packaged&&file===path.join(appPath,'runtime.json'))return JSON.stringify(runtime);if(!packaged&&file===authFile)return JSON.stringify(raw);throw Error('unexpected read '+file);}},
    'node:child_process':{spawn(){throw Error('No process allowed');}},
    './local-releases.cjs':{loadDevelopmentReleases:()=>[]},
    './client-lifecycle.cjs':{createClientLifecycle:()=>({getClients:async()=>[],dispose(){}})},
    './company-requests.cjs':{createCompanyRequests:()=>()=>{throw Error('No company request allowed');}},
    './downloads.cjs':{createDownloadHandler:()=>()=>{}},'./native-content.cjs':{createNativeContent:()=>()=>{}},'./connection-content.cjs':{createConnectionContent:()=>()=>{}},
    './connection-recovery.cjs':{createConnectionRecovery:()=>({connect:async()=>{},retryIfDisconnected:async()=>{},dispose(){}})},
  };
  const launch=packaged?['SYNK.exe']:['electron.exe',path.join(SRC,'..'),'--synk-dev','--client='+clientId];
  run('main.cjs',{stubs,process:{argv:[...launch,...argv],platform:'win32',arch:'x64',env:{},execPath:path.join(root,'electron.exe'),resourcesPath:path.join(root,'resources'),pid:4242}});
  await settle(()=>handlers.has('synk:environment'));
  const environment=await handlers.get('synk:environment')({sender:contents,senderFrame:frame});
  return {...seen,userData:paths.userData,sessionData:paths.sessionData,sessionScope:environment.sessionScope};
}

async function runPreview(file,argv){
  const seen=record(),paths={appData,downloads:path.join(root,'Downloads')};let window=null;
  const app=electronApp({packaged:false,seen,paths}),contents=Object.assign(new EventEmitter(),{setWindowOpenHandler(){},getURL:()=>'',send(){}});
  class Window extends EventEmitter{constructor(options){super();this.options=options;this.webContents=contents;window=this;}isDestroyed(){return false;}isVisible(){return false;}show(){}loadURL(){return Promise.resolve();}}
  const session=fakeSession();
  const electron={app,BrowserWindow:Window,ipcMain:{removeHandler(){},handle(){}},session:{fromPartition:name=>{seen.partitions.push(name);return session;}},protocol:{registerSchemesAsPrivileged(){}},Menu:{setApplicationMenu(){}},shell:{openExternal:async()=>{throw Error('No browser allowed');}},dialog:{},safeStorage:{isEncryptionAvailable:()=>false}};
  const stubs={...recordingStubs(seen,electron),'node:fs':{readFileSync:file=>{if(file===authFile)return JSON.stringify(raw);throw Error('unexpected read '+file);}}};
  run(file,{stubs,process:{argv:['electron.exe',path.join(SRC,file),...argv],platform:'win32',arch:'x64',env:{},stdout:{write(){}}}});
  await settle(()=>window!==null&&seen.suites.length>0);
  return {...seen,userData:paths.userData,sessionData:paths.sessionData};
}

test('catalog keeps every installed identity and only an explicit source run gets the .source scope',()=>{
  assert.deepEqual(Object.keys(CLIENTS).sort(),Object.keys(INSTALLED).sort());
  for(const [id,[appId,name,executable]]of Object.entries(INSTALLED)){
    for(const mode of ['development','release']){
      const preview=mode==='development',expected={appId:appId+(preview?'.preview':''),productName:name+(preview?' Preview':''),executableName:executable+(preview?'Preview':''),sessionScope:appId+(preview?'.preview':'')};
      for(const value of [identity(id,mode),identity(id,mode,{}),identity(id,mode,{packaged:true}),identity(id,mode,{packaged:undefined})])
        for(const [key,want]of Object.entries(expected))assert.equal(value[key],want,`${id} ${mode} ${key}`);
    }
    const source=identity(id,'development',{packaged:false});
    assert.equal(source.appId,appId+'.preview.source');assert.equal(source.sessionScope,appId+'.preview.source');
    assert.equal(source.productName,name+' Preview (소스 실행)');assert.equal(source.executableName,executable+'Preview');
  }
  for(const packaged of [true,undefined,null,0,'',1])assert.equal(sourceScope('development',packaged),'development');
  assert.equal(sourceScope('development',false),'development.source');
});

test('installed apps keep their exact name, profile folder, lock, taskbar ID, partition, vault and Suite folder',async()=>{
  for(const clientId of Object.keys(CLIENTS))for(const mode of ['development','release']){
    const scope='im.synk.'+clientId+(mode==='development'?'.preview':''),name=INSTALLED[clientId][1]+(mode==='development'?' Preview':''),label=clientId+' '+mode,r=await runMain({packaged:true,clientId,mode});
    assert.deepEqual(r.names,[name],label);assert.deepEqual(r.titles,[name],label);assert.deepEqual(r.trays,clientId==='platform'?[name]:[],label);
    assert.equal(r.userData,profile(scope),label);assert.equal(r.sessionData,path.join(profile(scope),'Session'),label);
    assert.deepEqual(r.locks,[profile(scope)],label);assert.deepEqual(r.appUserModelIds,[scope],label);
    assert.deepEqual(r.partitions,['persist:'+scope],label);assert.equal(r.sessionScope,scope,label);
    assert.deepEqual(r.tokenStores[0],{directory:profile(scope),scope},label);
    if(clientId==='messenger'){
      assert.deepEqual(r.tokenStores[1],{directory:path.join(profile(scope),'Teacher'),scope:scope+'.teacher'},label);
      assert.deepEqual(r.suites,[suiteFolder(mode,'messenger',mode),suiteFolder(mode,'teacher',mode)],label);
    }else assert.deepEqual(r.suites,[suiteFolder(mode,clientId,mode)],label);
  }
  // 설치 앱은 실행 인자로 소스 실행이 되지 않는다.
  const flagged=await runMain({packaged:true,clientId:'platform',argv:['--synk-dev','--client=platform']});
  assert.deepEqual(flagged.locks,[profile('im.synk.platform.preview')]);assert.deepEqual(flagged.appUserModelIds,['im.synk.platform.preview']);
});

test('source runs of the three apps keep name, folder, lock, taskbar ID, vault and Suite apart from the installed Preview',async()=>{
  for(const clientId of Object.keys(CLIENTS)){
    const installed='im.synk.'+clientId+'.preview',scope=installed+'.source',r=await runMain({packaged:false,clientId});
    // 트레이 툴팁·창 제목이 설치 앱과 달라야 둘이 같이 켜졌을 때 늘 켜 둘 설치 앱을 잘못 끄지 않는다.
    const name=INSTALLED[clientId][1]+' Preview (소스 실행)';
    assert.deepEqual(r.names,[name],clientId);assert.deepEqual(r.titles,[name],clientId);assert.deepEqual(r.trays,clientId==='platform'?[name]:[],clientId);
    assert.equal(r.userData,profile(scope),clientId);assert.equal(r.sessionData,path.join(profile(scope),'Session'),clientId);
    assert.deepEqual(r.locks,[profile(scope)],clientId);assert.deepEqual(r.appUserModelIds,[scope],clientId);
    assert.deepEqual(r.partitions,['persist:'+scope],clientId);assert.equal(r.sessionScope,scope,clientId);
    assert.deepEqual(r.tokenStores[0],{directory:profile(scope),scope},clientId);
    if(clientId==='messenger'){
      assert.deepEqual(r.tokenStores[1],{directory:path.join(profile(scope),'Teacher'),scope:scope+'.teacher'});
      assert.deepEqual(r.suites,[suiteFolder('development.source','messenger','development'),suiteFolder('development.source','teacher','development')]);
    }else assert.deepEqual(r.suites,[suiteFolder('development.source',clientId,'development')],clientId);
    // 소스 실행이 넘긴 어떤 폴더도 설치 앱의 프로필 폴더나 설치 앱 계열의 Suite 폴더 안이 아니다.
    for(const value of [r.userData,r.sessionData,...r.locks,...r.tokenStores.map(store=>store.directory),...r.suites]){
      assert.equal(inside(profile(installed),value),false,value);
      assert.equal(inside(path.join(appData,'SYNK Desktop','Suite','development'),value),false,value);
    }
  }
});

test('product and teacher previews keep their own folders and follow the source Platform Suite, never the installed one',async()=>{
  const source=await runMain({packaged:false,clientId:'platform'}),installed=await runMain({packaged:true,clientId:'platform'});
  assert.notEqual(source.suites[0],installed.suites[0]);
  for(const id of ['care','fortune','path']){
    const scope='im.synk.'+id+'.preview',r=await runPreview('product-main.cjs',['--synk-product-preview='+id]);
    assert.equal(r.userData,profile(scope),id);assert.deepEqual(r.locks,[profile(scope)],id);assert.deepEqual(r.appUserModelIds,[scope],id);
    assert.deepEqual(r.tokenStores,[{directory:profile(scope),scope}],id);assert.deepEqual(r.suites,[source.suites[0]],id);
  }
  const teacher=await runPreview('teacher-main.cjs',['--synk-teacher-preview']);
  assert.equal(teacher.userData,profile('im.synk.teacher.preview'));assert.deepEqual(teacher.locks,[profile('im.synk.teacher.preview')]);
  assert.deepEqual(teacher.suites,[source.suites[0]]);
});
