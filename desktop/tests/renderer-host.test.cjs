'use strict';
// PC 앱의 화면 호스트(launcher.mjs)를 실제 index.html의 id만 있는 DOM 대역에 올린다(PC 0.5.0 설계 4절).
// 옛 런처의 보기 일곱과 제목 줄 · 상태 줄 · 대화상자를 거둔 뒤에도 얼굴이 붙고, 지운 id를 찾지 않으며, 옛 화면을 그리지 않는지 본다.
// 포털 호스트와 얼굴은 대역이다(얼굴의 실제 흐름은 desktop/tools/orb-face-browser-qa.cjs가 실제 Chromium에서 본다).
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const personalEngine=require('../../atlas/personalization');
const RENDERER=path.join(__dirname,'../renderer');
const HTML=fs.readFileSync(path.join(RENDERER,'index.html'),'utf8');
const IDS=new Set([...HTML.matchAll(/\sid="([^"]+)"/g)].map(match=>match[1]));
const RELATIVE_IMPORT=/^import \{([^}]+)\} from '\.\/([\w-]+)\.mjs';$/gm;
const signedOut={configured:true,status:'signed-out',signedIn:false,sessionGeneration:0,library:{status:'unavailable',appIds:[]}};
const account=(id,appIds=['messenger'],extra={})=>({configured:true,status:'signed-in',signedIn:true,sessionGeneration:1,account:{synk_user_id:id,display_name:'합성 '+id},library:{status:'ready',appIds},...extra});
const environment={clientId:'platform',platform:'win32',arch:'x64',version:'0.5.0',mode:'release',closeToTray:true};
const settle=async()=>{for(let i=0;i<12;i++)await new Promise(resolve=>setImmediate(resolve));};

function hostScript(){
  const source=fs.readFileSync(path.join(RENDERER,'launcher.mjs'),'utf8');
  const script=source.replace(RELATIVE_IMPORT,(_all,names,specifier)=>'const {'+names.replace(/\s+as\s+/g,':')+'}=globalThis.rendererModules['+JSON.stringify(specifier)+'];');
  assert.equal(/^[ \t]*(?:import\s*[\w*{'"]|export\b)/m.exec(script),null,'launcher.mjs keeps to named relative imports');
  return {script,imports:[...source.matchAll(RELATIVE_IMPORT)].map(match=>match[2])};
}

async function fixture({initialAuth=signedOut,bridgeOverrides={},portalThrows=false,clients=[]}={}){
  const nodes=new Map(),looked=new Set(),subscriptions=new Map(),windowHandlers=new Map(),documentHandlers=new Map(),toasts=[];
  let currentAuth=initialAuth,portal=null,accountShown=0,accountHidden=0,authChanged=0,convenience=null;const changes=[];
  function element(id){
    looked.add(id);
    assert.ok(IDS.has(id),'launcher.mjs looks up #'+id+', which index.html no longer has');
    if(!nodes.has(id)){
      const handlers=new Map(),attributes=new Map();
      const node={id,hidden:id==='toast'||id==='view-account',open:false,returnValue:'',textContent:'',scrollTop:0,dataset:{},style:{},children:[],handlers,attributes,
        setAttribute:(name,value)=>attributes.set(name,String(value)),removeAttribute:name=>attributes.delete(name),
        addEventListener:(name,callback)=>handlers.set(name,callback),querySelector:()=>null,querySelectorAll:()=>[],focus(){},
        append(...children){this.children.push(...children);},showModal(){this.open=true;},close(value){this.open=false;if(value!==undefined)this.returnValue=value;handlers.get('close')?.();},
        get content(){return null;}};
      if(id==='toast')Object.defineProperty(node,'textContent',{get(){return this._text||'';},set(value){this._text=String(value);if(value)toasts.push(String(value));}});
      nodes.set(id,node);
    }
    return nodes.get(id);
  }
  const created=[];
  const root={dataset:{},classList:{toggle(){}}};
  const document={getElementById:element,documentElement:root,activeElement:null,hidden:false,body:{append:node=>created.push(node)},
    querySelector:selector=>selector==='.launcher'?{className:'launcher'}:selector==='dialog[open]'?null:null,querySelectorAll:()=>[],
    createElement:tag=>{const node={tagName:tag.toUpperCase(),dataset:{},children:[],hidden:false,className:'',textContent:'',innerHTML:'',attributes:new Map(),setAttribute(name,value){this.attributes.set(name,String(value));},
      addEventListener(){},append(...children){this.children.push(...children);},querySelector:()=>null};return node;},
    addEventListener:(name,callback)=>documentHandlers.set(name,callback),hasFocus:()=>true};
  const subscribe=(channel,callback)=>{const list=subscriptions.get(channel)||[];list.push(callback);subscriptions.set(channel,list);return ()=>{};};
  const bridge={getEnvironment:async()=>environment,getClients:async()=>clients,authStatus:async()=>currentAuth,
    onAuthChanged:callback=>subscribe('auth',callback),onClientsChanged:callback=>subscribe('clients',callback),
    getDesktopPreferences:async()=>({ok:true,preferences:{closeToTray:true,zoomFactor:1},capabilities:{tray:true}}),updateDesktopPreferences:async()=>({ok:true}),onDesktopPreferences:()=>{},
    accountRequest:async()=>({ok:true}),accountIdentity:async()=>({ok:true}),windowAction:async()=>{},
    careNotifications:{status:async()=>({ok:true,available:true,enabled:true}),configure:async()=>({ok:true}),onChanged:()=>()=>{}},
    ...bridgeOverrides};
  const {script,imports}=hostScript(),modules={};
  const seams={
    'portal-host':{mountDesktopPortalHost:options=>{if(portalThrows)throw new Error('face failed');portal={options,synced:[],syncAuth(auth){this.synced.push(auth);},isActive:()=>false,isClientShown:()=>true,clientMode:()=>'app',shouldBlockShortcuts:()=>false,syncReducedMotion(){}};return portal;}},
    'orb-face':{mountOrbFace(){},ORB_LOOK:{}},
    // 편의 모듈은 아래 따로 본다. 여기서는 호스트가 넘기는 것만 받는다
    convenience:{mountConvenience:options=>{convenience=options;const prefs={banners:true,schedule:false,mutedUntil:0,start:'22:00',end:'08:00',weekdays:false};return {notifications:{get:()=>prefs,set:patch=>Object.assign(prefs,patch)},clientsChanged(previous,next){changes.push([previous,next]);}};}},
    'account-page':{mountAccountPage:(root,options)=>({show(){accountShown++;},hide(){accountHidden++;},authChanged(){authChanged++;},securityVisitedRecently:()=>false,options})},
  };
  for(const specifier of imports)modules[specifier]=seams[specifier]||await import('../renderer/'+specifier+'.mjs');
  const storage=new Map();
  const context={rendererModules:modules,SynkAtlasPersonalization:personalEngine,document,synkDesktop:bridge,navigator:{onLine:true},
    window:{addEventListener:(name,callback)=>windowHandlers.set(name,callback)},addEventListener:()=>{},
    localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)},
    setTimeout:()=>0,clearTimeout(){},structuredClone,MutationObserver:undefined,Promise,JSON,Date,Math};
  context.globalThis=context;
  vm.createContext(context);vm.runInContext(script,context,{filename:'desktop/renderer/launcher.mjs'});
  await settle();
  return {context,element,looked,toasts,created,bridge,root,changes,get convenience(){return convenience;},get portal(){return portal;},counts:()=>({accountShown,accountHidden,authChanged}),
    emit(channel,value){if(channel==='auth')currentAuth=value;for(const callback of subscriptions.get(channel)||[])callback(value);},
    setAuth:value=>{currentAuth=value;},run:code=>vm.runInContext(code,context),beforeUnload(){const event={defaultPrevented:false,preventDefault(){this.defaultPrevented=true;}};windowHandlers.get('beforeunload')?.(event);return event.defaultPrevented;}};
}

test('index.html keeps only what the face and the old account page use',()=>{
  for(const id of ['main','view-account','toast','leave-dialog','leave-description','portal-entry','portal-window-chrome'])assert.ok(IDS.has(id),id+' stays');
  for(const id of ['view-home','view-library','view-solio','view-benefits','view-insight','view-downloads','view-settings','titlebar','account-dialog','content-dialog','personal-dialog','app-list','download-status'])assert.equal(IDS.has(id),false,id+' is gone');
  for(const sheet of ['member-home.css','convenience.css','pulse-client.css','member-insight.css','subscriptions.css'])assert.equal(HTML.includes(sheet),false,sheet+' is not loaded');
  assert.match(HTML,/<div class="launcher">/);
});

test('the host mounts the face from the real ids alone and says it is ready',async()=>{
  const f=await fixture();
  assert.ok(f.portal,'the portal host is mounted');
  assert.equal(f.root.dataset.ready,'true');
  assert.deepEqual([...f.looked].sort(),[...f.looked].filter(id=>IDS.has(id)).sort());
  assert.equal(f.toasts.length,0);
  const options=f.portal.options;
  assert.equal(options.hostElements.length,1);
  const plain=value=>JSON.parse(JSON.stringify(value));
  assert.deepEqual(plain(options.describePurposeTarget('world')),{external:false},'the old purpose ways are closed');
  assert.deepEqual(plain(await options.onOpenPurposeTarget('solio')),{ok:true});
  assert.deepEqual(plain(await options.onOpenPurposeTarget('path')),{ok:true});
  assert.deepEqual(plain(options.onEnsureEnteredView()),{ok:true});
  assert.equal(f.counts().accountShown,0,'nothing renders under the face');
});

test('the settings room gets no draft bridge and gets the PLEASURE notification switch',async()=>{
  const f=await fixture();
  const rooms=f.portal.options.faceOptions.rooms;
  assert.equal(rooms.drafts,null,'with no editor left the row is not built');
  assert.equal(typeof rooms.care.status,'function');assert.equal(typeof rooms.care.configure,'function');
  assert.deepEqual(await rooms.care.status(),{ok:true,available:true,enabled:true});
  const bare=await fixture({bridgeOverrides:{careNotifications:undefined}});
  assert.equal(bare.portal.options.faceOptions.rooms.care,null);
});

test('only the old account page opens, and leaving it hides it again',async()=>{
  const f=await fixture({initialAuth:account('member-a')});
  const face=f.portal.options.faceOptions;
  face.onOpenLegacy('settings');
  assert.equal(f.counts().accountShown,0,'no other old screen opens');
  face.onOpenLegacy('account');
  assert.equal(f.counts().accountShown,1);assert.equal(f.element('view-account').hidden,false);
  face.onCloseLegacy('account');
  assert.equal(f.counts().accountHidden,1);assert.equal(f.element('view-account').hidden,true);
});

test('auth changes reach the face and the old account page',async()=>{
  const f=await fixture();
  const before=f.portal.synced.length,changed=f.counts().authChanged;
  f.emit('auth',account('member-b'));
  assert.equal(f.portal.synced.length,before+1);
  assert.equal(f.portal.synced.at(-1).account.synk_user_id,'member-b');
  assert.ok(f.counts().authChanged>changed);
});

test('a session the server ended says so once, in the face words',async()=>{
  const f=await fixture({initialAuth:account('member-c')});
  f.emit('auth',{configured:true,status:'signed-out',signedIn:false,sessionGeneration:2,error:{code:'AUTH_REQUIRED'}});
  assert.equal(f.toasts.length,1);assert.match(f.toasts[0],/로그인이 끝났습니다/);
});

test('signing out from the face tells the result once and never touches an old dialog',async()=>{
  let signedOutAuth={configured:true,status:'signed-out',signedIn:false,sessionGeneration:2,library:{status:'unavailable',appIds:[]}};
  const f=await fixture({initialAuth:account('member-d'),bridgeOverrides:{authSignOut:async()=>{f.setAuth(signedOutAuth);return {ok:true};}}});
  await f.portal.options.faceOptions.onSignOut();await settle();
  assert.equal(f.toasts.length,1);assert.match(f.toasts[0],/^로그아웃했습니다\./);
});

test('a browser sign-in that ends badly says why once; a cancel says nothing',async()=>{
  const f=await fixture();
  f.emit('auth',{configured:true,status:'signing-in',signedIn:false});
  f.emit('auth',{configured:true,status:'signed-out',signedIn:false,error:{code:'AUTH_TIMEOUT',message:'로그인 시간이 지났습니다.'}});
  assert.deepEqual(f.toasts,['로그인 시간이 지났습니다.']);
  f.emit('auth',{configured:true,status:'signing-in',signedIn:false});
  f.emit('auth',{configured:true,status:'signed-out',signedIn:false,error:{code:'AUTH_CANCELLED',message:'취소'}});
  assert.equal(f.toasts.length,1);
});

test('with no editor left nothing asks before sign-out, update or closing, and leaving the page is never held',async()=>{
  const noop=async()=>({ok:true});
  const f=await fixture({initialAuth:account('member-e'),bridgeOverrides:{updateStatus:noop,checkForUpdate:noop,downloadUpdate:noop,installUpdate:noop,onUpdateChanged:()=>()=>{}}});
  assert.equal(await f.portal.options.faceOptions.rooms.confirmLeave(),true);
  assert.equal(typeof f.portal.options.faceOptions.rooms.updates.confirmInstall,'function','the update room gets the install check');
  assert.equal(await f.portal.options.faceOptions.rooms.updates.confirmInstall(),true);
  assert.equal(f.beforeUnload(),false);
  assert.equal(f.element('leave-dialog').open,false);
});

test('the old account page opens an installed Workspace and says why it cannot otherwise',async()=>{
  const launched=[];
  const installed=await fixture({initialAuth:account('member-f'),clients:[{id:'messenger',status:'installed',canLaunch:true}],bridgeOverrides:{launch:async id=>{launched.push(id);return {ok:true};}}});
  await installed.run('launchWorkspace()');
  assert.deepEqual(launched,['messenger']);assert.deepEqual(installed.toasts,['Workspace를 열었습니다.']);
  const missing=await fixture({initialAuth:account('member-g'),clients:[{id:'messenger',status:'not-installed',canLaunch:false,installer:{}}]});
  await missing.run('launchWorkspace()');
  // synk.im에는 Workspace 설치 파일이 없어 웹 계정 화면과 같은 말로 브라우저의 Workspace 주소를 안내한다(0.5.0 최종 검수 F5)
  assert.equal(missing.toasts[0],'이 PC에 Workspace 앱이 설치돼 있지 않습니다. 회사에서 안내받은 Workspace 주소로 브라우저에서 열어 주세요.');
  const denied=await fixture({initialAuth:account('member-h',['pulse'])});
  await denied.run('launchWorkspace()');
  assert.match(denied.toasts[0],/열 수 없습니다/);
  // 카본 검수 B1: 여는 중에 다시 누르면 아무 말도 하지 않고, 앱 줄을 아직 못 읽었으면 확인 중이라고 말한다
  let release;const slow=[];
  const pending=await fixture({initialAuth:account('member-i'),clients:[{id:'messenger',status:'installed',canLaunch:true}],bridgeOverrides:{launch:id=>{slow.push(id);return new Promise(resolve=>{release=resolve;});}}});
  const first=pending.run('launchWorkspace()');await settle();
  await pending.run('launchWorkspace()');
  assert.deepEqual(slow,['messenger']);assert.deepEqual(pending.toasts,[],'a second press while opening says nothing');
  release({ok:true});await first;
  assert.deepEqual(pending.toasts,['Workspace를 열었습니다.']);
  const loading=await fixture({initialAuth:account('member-j')});
  await loading.run('launchWorkspace()');
  assert.match(loading.toasts[0],/확인하는 중입니다/);
});

test('a face that fails to mount leaves window buttons and one line instead of an empty frameless window',async()=>{
  const f=await fixture({portalThrows:true});
  assert.equal(f.created.length,1);
  const box=f.created[0];
  assert.equal(box.className,'host-fallback');assert.equal(box.attributes.get('role'),'alert');
  assert.equal(box.children[1].textContent,'화면을 준비하지 못했습니다. 앱을 끄고 다시 열어 주세요.');
  assert.equal(f.root.dataset.ready,'true');
});

test('the development smoke and the screen probe fail when the face fell back to the one line',()=>{
  // GPT 검수 GA2: 실패 안내도 ready를 세우므로, 얼굴이 섰는지는 무대 · 얼굴 상태 · 실패 안내가 없음을 함께 본다
  const main=fs.readFileSync(path.join(__dirname,'../src/main.cjs'),'utf8');
  const face=main.match(/face:(!!document\.querySelector\('#portal-entry \[data-portal-stage\]'\)[^,]*),html:/);
  assert.ok(face,'the smoke face criterion is no longer where this test reads it');
  assert.match(main,/result\.nativeShell\.face&&/,'the smoke verdict needs the face');
  const page=({stage=true,state='invite',fallback=false})=>({
    querySelector:selector=>selector==='#portal-entry [data-portal-stage]'?(stage?{}:null):selector==='.host-fallback'?(fallback?{}:null):null,
    getElementById:id=>id==='portal-entry'?{dataset:state?{portalState:state}:{}}:null,
  });
  const judge=document=>vm.runInNewContext(face[1],{document});
  assert.equal(judge(page({})),true);
  assert.equal(judge(page({fallback:true})),false,'the one-line notice fails the smoke');
  assert.equal(judge(page({state:''})),false,'a stage the face never drove fails');
  assert.equal(judge(page({stage:false})),false);
  const probe=fs.readFileSync(path.join(__dirname,'../tools/native-ui-probe.cjs'),'utf8');
  assert.match(probe,/check\('orb-face-mounted',[^\n]*!q\('\.host-fallback'\)/,'the probe fails on the one-line notice too');
});

test('the host hands convenience the bridge, its storage, the toast and the close-to-tray setting',async()=>{
  const f=await fixture({initialAuth:account('member-i'),clients:[{id:'messenger',status:'installed',canLaunch:true}]});
  assert.equal(f.convenience.bridge,f.bridge);
  assert.equal(typeof f.convenience.onToast,'function');assert.deepEqual(f.convenience.getAppIds(),['messenger']);
  f.convenience.onDesktopPreferences({ok:true,preferences:{closeToTray:false},capabilities:{tray:true}});
  assert.equal(f.run('environment.closeToTray'),false);
  assert.ok(f.changes.length>=1,'client rows reach the install notice');
});

// 남은 편의 모듈(PC 0.5.0 설계 4.2-3): 화면 확대 키, 창이 뒤로 간 표시, 앱 설치 파일 소식, 알림 설정 통로
async function convenienceFixture({hidden=false,prefs={}}={}){
  const handlers=new Map(),root={dataset:{}},updates=[],toasts=[];
  globalThis.document={hidden,documentElement:root,addEventListener:(name,callback)=>handlers.set(name,callback),querySelector:()=>null};
  const {mountConvenience}=await import('../renderer/convenience.mjs');
  const store=new Map();
  const bridge={getDesktopPreferences:async()=>({ok:true,preferences:{zoomFactor:1,...prefs}}),updateDesktopPreferences:async patch=>{updates.push(patch);return {ok:true,preferences:{zoomFactor:patch.zoomFactor}};},onDesktopPreferences:()=>{}};
  const api=mountConvenience({bridge,storage:{getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,String(value)),removeItem:key=>store.delete(key)},onToast:text=>toasts.push(text),getAppIds:()=>['messenger']});
  await settle();
  const key=init=>{const event={key:init.key,ctrlKey:!!init.ctrlKey,metaKey:false,defaultPrevented:false,isComposing:false,keyCode:0,preventDefault(){this.defaultPrevented=true;}};handlers.get('keydown')(event);return event;};
  return {api,root,handlers,updates,toasts,key};
}

test('Ctrl with + and − steps the zoom through the settings room list, Ctrl+0 resets it, and plain keys do nothing',async()=>{
  const c=await convenienceFixture();
  assert.equal(c.key({key:'+',ctrlKey:true}).defaultPrevented,true);await settle();
  assert.deepEqual(c.updates,[{zoomFactor:1.1}]);
  c.key({key:'-',ctrlKey:true});await settle();
  assert.deepEqual(c.updates.at(-1),{zoomFactor:1});
  c.key({key:'+',ctrlKey:true});await settle();
  const before=c.updates.length;
  c.key({key:'0',ctrlKey:true});await settle();
  assert.equal(c.updates.length,before+1,'Ctrl+0 saves');assert.deepEqual(c.updates.at(-1),{zoomFactor:1});
  assert.equal(c.key({key:'+'}).defaultPrevented,false);
  delete globalThis.document;
});

test('a window behind another sets data-background so the face stops moving',async()=>{
  const c=await convenienceFixture({hidden:true});
  assert.equal(c.root.dataset.background,'true');
  globalThis.document.hidden=false;c.handlers.get('visibilitychange')();
  assert.equal(c.root.dataset.background,'false');
  delete globalThis.document;
});

test('an installer that becomes ready or fails says so once in the face words, and quiet settings keep it silent',async()=>{
  const c=await convenienceFixture();
  c.api.clientsChanged([{id:'messenger',installer:{status:'preparing'}}],[{id:'messenger',installer:{status:'ready'}}]);
  c.api.clientsChanged([{id:'messenger',installer:{status:'preparing'}}],[{id:'messenger',installer:{status:'error'}}]);
  assert.equal(c.toasts.length,2);
  assert.match(c.toasts[0],/설치 파일이 준비됐습니다.$/);assert.match(c.toasts[1],/설치 파일을 준비하지 못했습니다.$/);
  c.api.notifications.set({banners:false});
  c.api.clientsChanged([{id:'messenger',installer:{status:'preparing'}}],[{id:'messenger',installer:{status:'ready'}}]);
  assert.equal(c.toasts.length,2);
  delete globalThis.document;
});
