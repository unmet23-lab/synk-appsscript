'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const personalEngine=require('../../atlas/personalization');
const signedOut={configured:true,status:'signed-out',signedIn:false,sessionGeneration:0};
const account=(id,appIds,extra={})=>({configured:true,status:'signed-in',signedIn:true,sessionGeneration:1,account:{synk_user_id:id,display_name:'합성 '+id},library:{status:'ready',appIds},...extra});
const signedIn=account('student-a',['world']);
const environment={platform:'win32',arch:'x64',version:'0.3.0',mode:'development'};
const waitingClient={id:'world',status:'not-installed',canLaunch:false,installer:{status:'idle',canPrepare:true}};
const installedClient={id:'world',status:'installed',canLaunch:true,version:'0.3.0',installer:{status:'idle'}};
const viewKey=id=>'synk-launcher-view-v1'+(id?':account:'+encodeURIComponent(id):'');
const personalKey=id=>'synk.platform.launcher.personalization.v1'+(id?':account:'+encodeURIComponent(id):'');
const deferred=()=>{let resolve,reject;const promise=new Promise((done,fail)=>{resolve=done;reject=fail;});return {promise,resolve,reject};};

// Actual renderer handlers, including adversarial IPC ordering. This DOM double
// is not layout, real authentication, or an operating-service assertion.
async function fixture({initialAuth=signedOut,initialClients=[waitingClient],bridgeOverrides={},initialPreferences=null,personalPreferences=null,storageEntries=[],native=true}={}) {
  const nodes=new Map(),subscriptions=new Map(),documentHandlers=new Map(),lifecycleHandlers=new Map(),ready=deferred();let currentAuth=initialAuth,created=0;
  function element(id) {
    if(!nodes.has(id)) {
      const handlers=new Map(),attributes=new Map();
      nodes.set(id,{id,hidden:false,disabled:false,value:'',textContent:'',innerHTML:'',dataset:{},style:{},
        classList:{toggle(){},add(){},remove(){}},firstElementChild:{textContent:''},children:[],beforeNodes:[],
        before(...children){this.beforeNodes.push(...children);},append(...children){this.children.push(...children);},
        querySelector:id.startsWith('created-')?selector=>element(id+' '+selector):undefined,querySelectorAll:()=>[],
        setAttribute:(name,value)=>attributes.set(name,String(value)),removeAttribute:name=>attributes.delete(name),
        addEventListener:(name,callback)=>handlers.set(name,callback),focus(){},select(){},showModal(){this.open=true;},close(){this.open=false;},handlers,attributes});
    }
    return nodes.get(id);
  }
  const root=element('html');root.dataset=new Proxy({}, {set(object,key,value){object[key]=value;if(key==='ready')ready.resolve(value);return true;}});
  const document={getElementById:element,documentElement:root,activeElement:null,head:element('head'),createElement:tag=>element('created-'+tag+'-'+(++created)),
    querySelectorAll:selector=>selector==='dialog[open]'?[...nodes.values()].filter(node=>node.open):[],
    querySelector:selector=>selector==='.footer-progress'?element('footer-progress'):selector==='dialog[open]'?[...nodes.values()].find(node=>node.open):null,
    addEventListener:(name,callback)=>documentHandlers.set(name,callback)};
  const subscribe=(channel,callback)=>{const list=subscriptions.get(channel)||[];list.push(callback);subscriptions.set(channel,list);return ()=>{};};
  const bridge={getEnvironment:async()=>environment,getClients:async()=>initialClients,authStatus:async()=>currentAuth,
    onAuthChanged:callback=>subscribe('auth',callback),onClientsChanged:callback=>subscribe('clients',callback),onClientProgress:callback=>subscribe('progress',callback),...bridgeOverrides};
  const owner=initialAuth.signedIn?initialAuth.account?.synk_user_id:null;
  const storage=new Map([[viewKey(owner),initialPreferences],[personalKey(owner),personalPreferences],...storageEntries]);
  const modules={};for(const file of ['state','personalization','library','benefits','member-home','pulse-client','update-view'])modules[file]=await import('../renderer/'+file+'.mjs');
  // This auth fixture owns no layout. Navigation still invokes the real launcher's
  // applyRoute; the separately exercised convenience UI is not a second fake DOM.
  modules.convenience={mountConvenience:options=>({navigate:route=>options.applyRoute(route),refresh(){},capture(){},clientsChanged(){}})};
  const source=fs.readFileSync(path.join(__dirname,'../renderer/launcher.mjs'),'utf8').replace(/^import \{([^}]+)\} from '\.\/(state|personalization|library|benefits|member-home|platform-continuity|convenience|pulse-client|update-view)\.mjs';/gm,(_all,names,file)=>'const {'+names+'}=globalThis.rendererModules["'+file+'"];');
  // Execute the shipped continuity bundle in the same realm as the renderer.
  // Only its ESM export is adapted; mount/projection/dispatch remain real code.
  const continuity=fs.readFileSync(path.join(__dirname,'../renderer/platform-continuity.mjs'),'utf8').replace(/export \{\s*mountPlatformLibrary\s*\};\s*$/, 'globalThis.rendererModules["platform-continuity"]={mountPlatformLibrary};');
  assert.notEqual(continuity,fs.readFileSync(path.join(__dirname,'../renderer/platform-continuity.mjs'),'utf8'),'continuity module export must be loaded into the VM');
  const context={rendererModules:modules,SynkAtlasPersonalization:personalEngine,document,window:{addEventListener(){}},synkDesktop:native?bridge:undefined,
    localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},setTimeout:()=>0,clearTimeout(){},Intl,Date,
    addEventListener:(name,callback)=>lifecycleHandlers.set(name,callback),removeEventListener:name=>lifecycleHandlers.delete(name),structuredClone,TextEncoder,URL,URLSearchParams,queueMicrotask};
  vm.createContext(context);vm.runInContext('(function(){'+continuity+'\n})();',context,{filename:'desktop/renderer/platform-continuity.mjs'});vm.runInContext(source,context,{filename:'desktop/renderer/launcher.mjs'});
  return {element,bridge,storage,document,lifecycleHandlers,ready:ready.promise,setAuth:value=>{currentAuth=value;},
    ids:()=>[...element('app-list').innerHTML.matchAll(/data-app="([^"]+)"/g)].map(match=>match[1]),
    emit(channel,value){if(channel==='auth')currentAuth=value;for(const callback of subscriptions.get(channel)||[])callback(value);},
    async click(id){const callback=element(id).handlers.get('click');assert.equal(typeof callback,'function');await callback();},
    async action(dataset){await documentHandlers.get('click')({target:{closest:()=>({dataset})}});},
    publicBenefitControl(){
      const match=element('benefit-detail').innerHTML.match(/<(a|button)\b([^>]+)>(?:공개 웹에서 시작하기|여는 중…)[\s\S]*?<\/\1>/);
      assert.ok(match,'rendered public benefit control must exist');const [,tag,attrs]=match,dataset={};
      for(const [,key,value] of attrs.matchAll(/data-([\w-]+)="([^"]*)"/g))dataset[key.replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase())]=value;
      return {tag,dataset,disabled:/(?:^|\s)disabled(?:\s|$)/.test(attrs),href:attrs.match(/href="([^"]*)"/)?.[1]};
    },
    async clickPublicBenefit(){const control=this.publicBenefitControl();if(control.disabled)return;await documentHandlers.get('click')({target:{closest:selector=>selector==='button'&&control.tag==='button'?control:null}});},
    input(id,value){const el=element(id);el.value=value;el.handlers.get('input')?.({target:el});},
    submitPersonal(){element('personal-form').handlers.get('submit')({preventDefault(){}});}};
}
async function savePersonal(f,{context='teacher',consent=true}={}){
  await f.click('personal-open');f.element('personal-context').value=context;f.element('personal-context').handlers.get('change')();
  f.element('personal-text').value='large';f.element('personal-explanation').value='brief';f.element('personal-motion').value='reduced';f.element('personal-consent').checked=consent;f.submitPersonal();
}

for(const id of ['path'])test(id+' native preview invokes only its dedicated bridge with a library grant',async()=>{
  const calls=[];
  const f=await fixture({initialAuth:account(id+'-member',[id]),bridgeOverrides:{getEnvironment:async()=>({...environment,productPreviewsAvailable:[id]}),openProductPreview:async value=>{calls.push(value);return {ok:true};},launch:async()=>assert.fail('preview must not use installer launch')}});
  assert.equal(await f.ready,'true');assert.deepEqual(f.ids(),[id]);assert.equal(f.element('primary-action').dataset.action,'product-preview');assert.equal(f.element('primary-action').disabled,false);
  assert.match(f.element('detail-content').innerHTML,/공개 MVP/);assert.doesNotMatch(f.element('detail-content').innerHTML,/사내 대화/);
  await f.click('primary-action');assert.deepEqual(calls,[id]);assert.match(f.element('toast').textContent,/별도 창/);
  f.emit('auth',account('unrelated',['world']));await f.action({command:'product-preview',client:id});assert.deepEqual(calls,[id]);
});
test('product preview stays unavailable without source capability and ignores late completion for another account',async()=>{
  const pending=deferred();let calls=0;
  const noCapability=await fixture({initialAuth:account('member',['path']),bridgeOverrides:{openProductPreview:async()=>{calls++;return {ok:true};}}});await noCapability.ready;await noCapability.action({command:'product-preview',client:'path'});assert.equal(calls,0);assert.equal(noCapability.element('primary-action').disabled,true);
  const f=await fixture({initialAuth:account('member',['path']),bridgeOverrides:{getEnvironment:async()=>({...environment,productPreviewsAvailable:['path']}),openProductPreview:()=>pending.promise}});await f.ready;
  const opening=f.click('primary-action');f.emit('auth',account('new-member',['world']));pending.resolve({ok:true});await opening;
  assert.equal(f.element('toast').hidden,true);assert.equal(f.element('breadcrumb-app').textContent,'SYNK WORLD');
});

test('both signup buttons open registration and preserve guest state without starting login',async()=>{
  let opens=0;const f=await fixture({bridgeOverrides:{authSignUp:async()=>{opens++;return {ok:true};},authSignIn:async()=>assert.fail('signup must not authenticate'),authSignOut:async()=>assert.fail('signup must not sign out')}});await f.ready;
  const storage=JSON.stringify([...f.storage]);assert.equal(f.element('account-label').textContent,'로그인');
  for(const id of ['signup-button','sign-up']){assert.equal(f.element(id).hidden,false);assert.equal(f.element(id).disabled,false);assert.equal(f.element(id).textContent,'회원가입');await f.click(id);}
  assert.equal(opens,2);assert.equal(f.element('account-dialog').open,true);assert.match(f.element('account-state').textContent,/가입을 마쳤다면 아래 로그인/);assert.equal(f.element('sign-in').hidden,false);assert.equal(f.element('sign-in').disabled,false);assert.deepEqual(f.ids(),['world']);assert.equal(JSON.stringify([...f.storage]),storage);
});
test('signup blocks double opens and concurrent login, reports failures, and ignores late account changes',async()=>{
  const pending=deferred();let opens=0,logins=0;const f=await fixture({bridgeOverrides:{authSignUp:()=>{opens++;return pending.promise;},authSignIn:async()=>{logins++;}}});await f.ready;
  const opening=f.click('signup-button');assert.equal(f.element('sign-up').disabled,true);assert.equal(f.element('sign-in').disabled,true);await f.click('sign-up');await f.click('sign-in');assert.equal(opens,1);assert.equal(logins,0);
  pending.resolve({ok:false});await opening;assert.match(f.element('toast').textContent,/회원가입 페이지를 열지 못했어요/);assert.equal(f.element('sign-up').disabled,false);
  const late=deferred(),g=await fixture({bridgeOverrides:{authSignUp:()=>late.promise}});await g.ready;const request=g.click('sign-up');g.emit('auth',signedIn);late.resolve({ok:true});await request;
  assert.equal(g.element('signup-button').hidden,true);assert.equal(g.element('sign-up').hidden,true);assert.equal(g.element('signup-help').hidden,true);assert.equal(g.element('account-label').textContent,'합성 student-a');assert.doesNotMatch(g.element('account-state').textContent,/회원가입 페이지를 열었어요/);
});
test('signup controls stay unavailable while sessions change or the bridge is unavailable',async()=>{
  for(const status of ['restoring','signing-in','signing-out']){let calls=0;const f=await fixture({initialAuth:{...signedOut,status},bridgeOverrides:{authSignUp:async()=>{calls++;return {ok:true};}}});await f.ready;for(const id of ['signup-button','sign-up']){assert.equal(f.element(id).disabled,true);await f.click(id);}assert.equal(calls,0);}
  for(const native of [true,false]){const f=await fixture({native});await f.ready;assert.equal(f.element('sign-up').disabled,true);await f.click('sign-up');}
});

test('launcher mounts shared update controls and explicitly opens a ready installer without auth calls',async()=>{
  let installs=0;const status={ok:true,state:'ready',currentVersion:'0.4.4',latestVersion:'0.4.5'};
  const f=await fixture({bridgeOverrides:{updateStatus:async()=>status,checkForUpdate:async()=>status,downloadUpdate:async()=>status,installUpdate:async()=>{installs++;return {...status,state:'opening'};},onUpdateChanged:()=>()=>{},authSignIn:async()=>assert.fail('update must not authenticate'),authSignOut:async()=>assert.fail('update must not sign out')}});await f.ready;
  assert.equal(f.element('platform-update-settings-install').hidden,false);assert.equal(f.element('platform-update-downloads-install').textContent,'앱 종료 후 설치 파일 열기');
  await f.click('platform-update-settings-install');assert.equal(installs,1);assert.equal(f.element('platform-update-downloads').dataset.updateState,'opening');assert.deepEqual(f.ids(),['world']);
});

test('signed out exposes only public WORLD, never the complete catalog',async()=>{
  const f=await fixture({initialPreferences:JSON.stringify({selected:'messenger',favorites:['messenger']})});assert.equal(await f.ready,'true');assert.deepEqual(f.ids(),['world']);assert.doesNotMatch(f.element('download-list').innerHTML,/SYNK Workspace/);assert.equal(f.element('teacher-web-link').hidden,true);await f.action({app:'messenger'});assert.equal(f.element('breadcrumb-app').textContent,'SYNK WORLD');
});
for(const status of ['restoring','signing-in','error'])test(status+' never borrows guest or prior library',async()=>{
  const f=await fixture({initialAuth:{...signedOut,status}});assert.equal(await f.ready,'true');assert.deepEqual(f.ids(),[]);assert.equal(f.element('app-detail').hidden,true);assert.equal(f.element('primary-action').disabled,true);assert.equal(f.element('recommendation').hidden,true);
});
test('signed-in missing, unavailable or empty library fails closed',async()=>{
  for(const library of [undefined,{status:'unavailable',appIds:['messenger']},{status:'ready',appIds:[]}]){const f=await fixture({initialAuth:account('staff',['messenger'],{library})});assert.equal(await f.ready,'true');assert.deepEqual(f.ids(),[]);assert.equal(f.element('app-detail').hidden,true);assert.doesNotMatch(f.element('download-list').innerHTML,/SYNK (WORLD|Workspace)/);}
});
test('verified account apps define library, selection and installation rows',async()=>{
  for(const [id,appIds]of [['student',['world']],['teacher',['teacher']],['staff',['messenger']],['customer',['pulse']]]){const f=await fixture({initialAuth:account(id,appIds),initialPreferences:JSON.stringify({selected:'partners',favorites:['partners']})});assert.equal(await f.ready,'true');assert.deepEqual(f.ids().sort(),[...appIds].sort());assert.equal(f.element('breadcrumb-app').textContent,({student:'SYNK WORLD',teacher:'워크스페이스 · 내 수업',staff:'SYNK Workspace',customer:'SYNK PULSE'})[id]);for(const forbidden of ['WORLD','Workspace'].filter(name=>!appIds.includes(name==='WORLD'?'world':'messenger')))assert.doesNotMatch(f.element('download-list').innerHTML,new RegExp('SYNK '+forbidden));}
});
test('authentication restored during client inspection survives old snapshot',async()=>{
  const clients=deferred();const f=await fixture({initialAuth:{...signedOut,status:'restoring'},bridgeOverrides:{getClients:()=>clients.promise}});f.emit('auth',signedIn);assert.equal(f.element('account-label').textContent,'합성 student-a');assert.deepEqual(f.ids(),['world']);clients.resolve([waitingClient]);assert.equal(await f.ready,'true');assert.deepEqual(f.ids(),['world']);assert.equal(f.element('sign-out').hidden,false);
});
test('new client event is not overwritten by old initial client snapshot',async()=>{
  const clients=deferred();const f=await fixture({initialAuth:signedIn,bridgeOverrides:{getClients:()=>clients.promise}});f.emit('clients',[installedClient]);clients.resolve([waitingClient]);assert.equal(await f.ready,'true');assert.equal(f.element('primary-action').dataset.action,'launch');assert.equal(f.element('install-version').textContent,'0.3.0');
});
test('hidden clients cannot return through search, direct selection or progress',async()=>{
  const f=await fixture({initialAuth:signedIn});assert.equal(await f.ready,'true');f.input('search','메신저');assert.deepEqual(f.ids(),[]);f.input('search','');await f.action({app:'messenger'});assert.equal(f.element('breadcrumb-app').textContent,'SYNK WORLD');f.emit('clients',[installedClient,{id:'messenger',installer:{status:'preparing',transferredBytes:8,totalBytes:10}}]);assert.doesNotMatch(f.element('download-list').innerHTML,/Messenger/);assert.equal(f.element('queue-count').hidden,true);
});
test('granted PULSE launches the independent window and keeps prior local drafts behind an explicit entry',async()=>{
  let called=0,opened=0;const f=await fixture({initialAuth:account('customer',['pulse']),initialClients:[{id:'pulse',canLaunch:true,installer:{canPrepare:true}}],bridgeOverrides:{launch:async()=>{called++;return {ok:true};},openPulseApp:async()=>{opened++;return {ok:true};}}});assert.equal(await f.ready,'true');assert.equal(f.element('primary-action').disabled,false);assert.equal(f.element('primary-action').dataset.action,'pulse-app');assert.doesNotMatch(f.element('download-list').innerHTML,/SYNK PULSE/);assert.equal(f.element('pulse-client').hidden,true);await f.click('primary-action');assert.equal(called,0);assert.equal(opened,1);assert.deepEqual(f.ids(),['pulse']);await f.action({pulseLegacy:'open'});assert.equal(f.element('pulse-client').hidden,false);assert.match(f.element('pulse-client').innerHTML,/모델 캐스팅/);assert.match(f.element('pulse-client').innerHTML,/포트폴리오/);
});
test('PULSE sidebar opens separately without replacing the current app and failure leaves no launch record',async()=>{
  let called=0;const f=await fixture({initialAuth:account('customer',['world','pulse']),bridgeOverrides:{openPulseApp:async()=>{called++;return {ok:false,code:'PULSE_APP_OPEN_FAILED'};}}});assert.equal(await f.ready,'true');const before=f.element('breadcrumb-app').textContent;await f.action({app:'pulse'});await new Promise(resolve=>setImmediate(resolve));assert.equal(called,1);assert.equal(f.element('breadcrumb-app').textContent,before);assert.match(f.element('toast').textContent,/PULSE를 열지 못했어요/);assert.equal(f.element('pulse-client').hidden,true);assert.equal(f.storage.get(viewKey('customer')),null);
});
test('teacher preview needs server library and explicit development capability',async()=>{
  let calls=0;const opts={getEnvironment:async()=>({...environment,teacherPreviewAvailable:true}),openTeacherPreview:async()=>{calls++;return {ok:true};}};const f=await fixture({initialAuth:account('teacher',['teacher']),bridgeOverrides:opts});assert.equal(await f.ready,'true');assert.equal(f.element('primary-action').dataset.action,'teacher-preview');await f.click('primary-action');assert.equal(calls,1);assert.notEqual(f.element('last-launch').textContent,'기록 없음');const old=await fixture({initialAuth:account('teacher',['teacher']),bridgeOverrides:{openTeacherPreview:opts.openTeacherPreview}});assert.equal(await old.ready,'true');assert.equal(old.element('primary-action').disabled,true);await old.click('primary-action');assert.equal(calls,1);
});
test('self-declared teacher interest changes presentation without granting apps',async()=>{
  const f=await fixture({initialAuth:signedIn});assert.equal(await f.ready,'true');await savePersonal(f,{consent:false});assert.match(f.element('personal-message').textContent,/동의/);assert.equal(f.storage.get(personalKey('student-a')),null);f.element('personal-consent').checked=true;f.submitPersonal();assert.equal(f.element('html').dataset.textSize,'large');assert.deepEqual(f.ids(),['world']);assert.doesNotMatch(f.element('recommendation').innerHTML,/data-personal-app="(?:teacher|studio)"/);assert.ok(f.storage.get(personalKey('student-a')));await f.click('personal-clear');assert.equal(f.storage.has(personalKey('student-a')),false);assert.equal(f.element('html').dataset.textSize,'standard');assert.deepEqual(f.ids(),['world']);
});
test('account switch clears selection, favorites, search, dialogs and personal settings',async()=>{
  const a=account('staff-a',['messenger']),b=account('student-b',['world'],{sessionGeneration:2});const f=await fixture({initialAuth:a,initialPreferences:JSON.stringify({selected:'messenger',favorites:['messenger'],lastLaunch:{messenger:1000}})});assert.equal(await f.ready,'true');await savePersonal(f,{context:'team'});await f.click('personal-open');f.input('search','메신저');f.emit('auth',b);assert.deepEqual(f.ids(),['world']);assert.equal(f.element('search').value,'');assert.equal(f.element('personal-dialog').open,false);assert.equal(f.element('last-launch').textContent,'기록 없음');assert.equal(f.element('favorite').attributes.get('aria-pressed'),'false');assert.equal(f.element('html').dataset.textSize,'standard');assert.equal(f.element('recommendation').hidden,true);f.emit('auth',a);assert.equal(f.element('breadcrumb-app').textContent,'SYNK Workspace');assert.equal(f.element('favorite').attributes.get('aria-pressed'),'true');assert.equal(f.element('html').dataset.textSize,'large');
});
test('logout never copies member settings into guest storage',async()=>{
  const f=await fixture({initialAuth:account('staff',['messenger'])});assert.equal(await f.ready,'true');await savePersonal(f,{context:'team'});await f.click('favorite');f.emit('auth',{...signedOut,sessionGeneration:2});assert.deepEqual(f.ids(),['world']);assert.equal(f.element('html').dataset.textSize,'standard');assert.equal(f.element('recommendation').hidden,true);assert.doesNotMatch(f.storage.get(viewKey())||'',/messenger/);assert.equal(f.storage.get(personalKey()),undefined);
});
test('late launch success cannot write previous run into next account',async()=>{
  const launch=deferred();const f=await fixture({initialAuth:signedIn,initialClients:[installedClient],bridgeOverrides:{launch:()=>launch.promise}});assert.equal(await f.ready,'true');const pending=f.click('primary-action');f.emit('auth',account('student-b',['world'],{sessionGeneration:2}));launch.resolve({ok:true});await pending;assert.equal(f.element('last-launch').textContent,'기록 없음');assert.ok(!f.storage.get(viewKey('student-b'))||!JSON.parse(f.storage.get(viewKey('student-b'))).lastLaunch?.world);
});
test('revocation closes content dialog and clears recommendation and action',async()=>{
  const f=await fixture({initialAuth:signedIn});assert.equal(await f.ready,'true');await savePersonal(f,{context:'student'});await f.action({game:'racing'});assert.equal(f.element('content-dialog').open,true);f.emit('auth',account('student-a',[],{library:{status:'unavailable',appIds:[]}}));assert.deepEqual(f.ids(),[]);assert.equal(f.element('content-dialog').open,false);assert.equal(f.element('recommendation').hidden,true);assert.equal(f.element('app-detail').hidden,true);assert.equal(f.element('primary-action').disabled,true);
});
test('temporary library refresh preserves the same account selection and search',async()=>{
  const member=account('team-refresh',['world','messenger']);const f=await fixture({initialAuth:member});assert.equal(await f.ready,'true');await f.action({app:'messenger'});await f.click('favorite');f.input('search','Studio');const stored=f.storage.get(viewKey('team-refresh'));
  f.emit('auth',{...member,library:{status:'unavailable',appIds:[]}});assert.deepEqual(f.ids(),[]);assert.equal(f.element('app-detail').hidden,true);assert.equal(f.element('search').value,'Studio');assert.equal(f.storage.get(viewKey('team-refresh')),stored);
  f.emit('auth',member);assert.deepEqual(f.ids(),['messenger']);assert.equal(f.element('breadcrumb-app').textContent,'SYNK Workspace');assert.equal(f.element('favorite').attributes.get('aria-pressed'),'true');assert.equal(f.storage.get(viewKey('team-refresh')),stored);
});
test('late authentication completions and errors cannot overwrite a newer account',async()=>{
  for(const [button,method,initial,result]of [['sign-in','authSignIn',signedOut,'reject'],['sign-out','authSignOut',signedIn,'resolve'],['cancel-sign-in','authCancelSignIn',{...signedOut,status:'signing-in'},'reject']]){
    const operation=deferred();const f=await fixture({initialAuth:initial,bridgeOverrides:{[method]:()=>operation.promise}});assert.equal(await f.ready,'true');const pending=f.click(button);f.emit('auth',account('new-teacher',['teacher'],{sessionGeneration:9}));operation[result](result==='reject'?new Error('old request failed'):{ok:true,serverRevoked:true,serverSessionRevoked:true});await pending;assert.deepEqual(f.ids(),['teacher']);assert.equal(f.element('account-label').textContent,'합성 new-teacher');assert.equal(f.element('toast').hidden,true);
  }
});
for(const [label,result,pattern]of [
  ['failed local deletion',{ok:false,serverRevoked:true,serverSessionRevoked:true,error:{code:'AUTH_FAILED'}},/로그아웃을 완료하지 못했어요/],
  ['local-only revocation',{ok:true,serverRevoked:false,serverSessionRevoked:false},/이 기기에서 로그아웃/],
  ['fully confirmed logout',{ok:true,serverRevoked:true,serverSessionRevoked:true},/^로그아웃했어요\.$/],
])for(const emitEvent of [false,true])test(label+' retains honest account feedback '+(emitEvent?'after native signed-out event':'without event'),async()=>{const f=await fixture({initialAuth:signedIn});assert.equal(await f.ready,'true');f.bridge.authSignOut=async()=>{const out={...signedOut,sessionGeneration:signedIn.sessionGeneration+1};if(emitEvent)f.emit('auth',out);else f.setAuth(out);return result;};await f.click('sign-out');assert.match(f.element('toast').textContent,pattern);assert.equal(f.element('sign-out').disabled,false);assert.deepEqual(f.ids(),['world']);});

for(const [label,result,pattern]of [
  ['confirmed logout with failed draft cleanup',{ok:true,serverRevoked:true,serverSessionRevoked:true,draftRecoveryCleanup:{ok:false,code:'DRAFT_STORAGE_FAILED'}},/^로그아웃했어요\.[\s\S]*암호화된 초안 복구본[\s\S]*같은 SYNK ID/],
  ['incomplete server logout with failed draft cleanup',{ok:true,serverRevoked:false,serverSessionRevoked:false,draftRecoveryCleanup:{ok:false,code:'DRAFT_STORAGE_FAILED'}},/이 기기에서 로그아웃[\s\S]*서버 세션 종료[\s\S]*암호화된 초안 복구본/],
  ['failed authentication cleanup with failed draft cleanup',{ok:false,serverRevoked:true,serverSessionRevoked:true,draftRecoveryCleanup:{ok:false,code:'DRAFT_STORAGE_FAILED'}},/로그아웃을 완료하지 못했어요[\s\S]*암호화된 초안 복구본/],
  ['truthy draft cleanup flag is not a failure',{ok:true,serverRevoked:true,serverSessionRevoked:true,draftRecoveryCleanup:{ok:'false'}},/^로그아웃했어요\.$/],
])for(const emitEvent of [false,true])test(label+' reports distinct outcomes '+(emitEvent?'after native event':'without event'),async()=>{
  const f=await fixture({initialAuth:signedIn});assert.equal(await f.ready,'true');
  f.bridge.authSignOut=async()=>{const out={...signedOut,sessionGeneration:signedIn.sessionGeneration+1};if(emitEvent)f.emit('auth',out);else f.setAuth(out);return result;};
  await f.click('sign-out');assert.match(f.element('toast').textContent,pattern);
  assert.equal(f.element('sign-out').disabled,false);assert.deepEqual(f.ids(),['world']);
  assert.doesNotMatch(f.element('toast').textContent,/EPERM|EBUSY|\.enc|ciphertext|synthetic-owner/);
});

test('late draft cleanup warning cannot overwrite a different account or the same account with a new generation',async()=>{
  for(const id of ['student-a','new-teacher']){
    const operation=deferred(),f=await fixture({initialAuth:signedIn,bridgeOverrides:{authSignOut:()=>operation.promise}});assert.equal(await f.ready,'true');
    await f.click('account-button');assert.equal(f.element('account-dialog').open,true);
    const pending=f.click('sign-out'),next=account(id,['teacher'],{sessionGeneration:9});f.emit('auth',next);
    operation.resolve({ok:true,serverRevoked:true,serverSessionRevoked:true,draftRecoveryCleanup:{ok:false,code:'DRAFT_STORAGE_FAILED'}});await pending;
    assert.deepEqual(f.ids(),['teacher']);assert.equal(f.element('account-label').textContent,'합성 '+id);assert.equal(f.element('toast').hidden,true);
    assert.equal(f.element('account-dialog').open,true,'an old logout must not close the newer account dialog');
  }
});

test('logout status refresh cannot close a fresh sign-in dialog or publish an old cleanup warning',async t=>{
  const status=deferred(),statusEntered=deferred(),signIn=deferred();let signInCalls=0;
  const f=await fixture({initialAuth:signedIn,bridgeOverrides:{authSignIn:()=>{signInCalls++;return signIn.promise;}}});await f.ready;
  await f.click('account-button');
  f.bridge.authSignOut=async()=>{f.emit('auth',{...signedOut,sessionGeneration:2});return {ok:true,serverRevoked:true,serverSessionRevoked:true,draftRecoveryCleanup:{ok:false,code:'DRAFT_STORAGE_FAILED'}};};
  f.bridge.authStatus=()=>{statusEntered.resolve();return status.promise;};
  const logout=f.click('sign-out');await statusEntered.promise;
  assert.equal(f.element('sign-in').hidden,false);const signing=f.click('sign-in');
  assert.equal(signInCalls,1);assert.equal(f.element('cancel-sign-in').hidden,false);
  status.resolve({...signedOut,sessionGeneration:2});await logout;
  t.diagnostic(JSON.stringify({stage:'old-status-arrives-after-fresh-sign-in',dialogOpen:f.element('account-dialog').open,toastHidden:f.element('toast').hidden,toast:f.element('toast').textContent,accountLabel:f.element('account-label').textContent,cancelHidden:f.element('cancel-sign-in').hidden}));
  try{
    assert.equal(f.element('account-dialog').open,true,'the fresh sign-in dialog must stay open');
    assert.equal(f.element('toast').hidden,true,'an old logout cleanup warning must not enter the new sign-in');
    assert.equal(f.element('account-label').textContent,'로그인 연결 중');
    assert.equal(f.element('cancel-sign-in').hidden,false);
  }finally{f.bridge.authStatus=async()=>account('fresh-after-logout',['teacher'],{sessionGeneration:3});signIn.resolve({ok:true});await signing;}
});

test('accepted logout closes the account modal before its outcome while sign-in cancellation keeps the dialog',async()=>{
  for(const [result,pattern]of [
    [{ok:true,serverRevoked:true,serverSessionRevoked:true},/^로그아웃했어요\.$/],
    [{ok:false,serverRevoked:true,serverSessionRevoked:true,error:{code:'AUTH_FAILED'}},/로그아웃을 완료하지 못했어요/],
    [{ok:true,serverRevoked:false,serverSessionRevoked:false},/서버 세션 종료는 연결 후/],
    [{ok:true,serverRevoked:true,serverSessionRevoked:true,draftRecoveryCleanup:{ok:false,code:'DRAFT_STORAGE_FAILED'}},/암호화된 초안 복구본[\s\S]*같은 SYNK ID/],
  ]){
    const f=await fixture({initialAuth:signedIn});await f.ready;await f.click('account-button');assert.equal(f.element('account-dialog').open,true);
    f.bridge.authSignOut=async()=>{f.setAuth({...signedOut,sessionGeneration:signedIn.sessionGeneration+1});return result;};
    await f.click('sign-out');assert.equal(f.element('account-dialog').open,false,'the warning cannot remain behind the account modal');
    assert.equal(f.element('toast').hidden,false);assert.match(f.element('toast').textContent,pattern);assert.deepEqual(f.ids(),['world']);
  }
  const cancelled=await fixture({initialAuth:{...signedOut,status:'signing-in'},bridgeOverrides:{authCancelSignIn:async()=>{cancelled.setAuth({...signedOut,sessionGeneration:1});return {ok:true};}}});
  await cancelled.ready;await cancelled.click('account-button');await cancelled.click('cancel-sign-in');
  assert.equal(cancelled.element('account-dialog').open,true,'cancelling sign-in is not an accepted logout');
});

test('retired Studio and SHIFT selections stay hidden and cannot launch or grant Messenger',async()=>{for(const id of ['studio','shift']){let calls=0;const f=await fixture({initialAuth:account('legacy-'+id,[id]),initialPreferences:JSON.stringify({selected:id,favorites:[id]}),initialClients:[{id,canLaunch:true}],bridgeOverrides:{getEnvironment:async()=>({...environment,productPreviewsAvailable:['path','shift']}),openProductPreview:async()=>{calls++;},launch:async()=>{calls++;}}});assert.equal(await f.ready,'true');assert.deepEqual(f.ids(),[]);assert.equal(f.element('app-detail').hidden,true);await f.action({app:id});await f.action({command:'product-preview',client:id});await f.action({command:'launch',client:'messenger'});assert.equal(calls,0);assert.doesNotMatch(f.element('download-list').innerHTML,/Messenger/);}});
test('Messenger workroom lists production review and AI practice without duplicate apps',async()=>{const f=await fixture({initialAuth:account('workroom-member',['messenger','studio','shift']),initialPreferences:JSON.stringify({selected:'shift',favorites:['studio','shift']})});assert.equal(await f.ready,'true');assert.deepEqual(f.ids(),['messenger']);assert.equal(f.element('breadcrumb-app').textContent,'SYNK Workspace');assert.match(f.element('detail-content').innerHTML,/제작 데스크/);assert.match(f.element('detail-content').innerHTML,/게시 전 점검/);assert.match(f.element('detail-content').innerHTML,/AI 업무 연습/);assert.equal(f.element('favorite').attributes.get('aria-pressed'),'false');});

test('public benefit introductions never grant a guest app or a preview action',async()=>{
  let calls=0;const f=await fixture({initialAuth:signedOut,bridgeOverrides:{getEnvironment:async()=>({...environment,productPreviewsAvailable:['care','fortune','rehearsal','family-album']}),openProductPreview:async()=>{calls++;return {ok:true};}}});
  assert.equal(await f.ready,'true');await f.action({view:'benefits'});
  assert.equal(f.element('view-benefits').hidden,false);assert.deepEqual(f.ids(),['world']);
  for(const id of ['care','fortune','rehearsal','family-album']){
    await f.action({benefit:id});assert.equal(f.element('benefit-detail').hidden,false);
    assert.match(f.element('benefit-detail').innerHTML,/benefit-availability/);
    assert.doesNotMatch(f.element('benefit-detail').innerHTML,/data-benefit-preview/);
    await f.action({benefitPreview:id});
  }
  assert.equal(calls,0);assert.deepEqual(f.ids(),['world']);
  await f.action({view:'benefits'});assert.equal(f.element('benefits-overview').hidden,false);assert.equal(f.element('benefit-detail').hidden,true);
});

test('benefit preview needs both native capability and current server entitlement, including after revocation',async()=>{
  let calls=0;const f=await fixture({initialAuth:account('care-member',['care']),bridgeOverrides:{getEnvironment:async()=>({...environment,productPreviewsAvailable:['care']}),openProductPreview:async id=>{assert.equal(id,'care');calls++;return {ok:true};}}});
  assert.equal(await f.ready,'true');await f.action({benefit:'care'});assert.match(f.element('benefit-detail').innerHTML,/data-benefit-preview="care"/);
  await f.action({benefitPreview:'care'});assert.equal(calls,1);
  f.emit('auth',account('care-member',[],{sessionGeneration:2}));
  assert.doesNotMatch(f.element('benefit-detail').innerHTML,/data-benefit-preview/);await f.action({benefitPreview:'care'});assert.equal(calls,1);
  const noCapability=await fixture({initialAuth:account('care-member',['care']),bridgeOverrides:{openProductPreview:async()=>{calls++;}}});
  assert.equal(await noCapability.ready,'true');await noCapability.action({benefit:'care'});assert.doesNotMatch(noCapability.element('benefit-detail').innerHTML,/data-benefit-preview/);await noCapability.action({benefitPreview:'care'});assert.equal(calls,1);
});

test('benefit search opens a public detail without replacing authorized app selections',async()=>{
  const f=await fixture({initialAuth:account('student-search',['world'])});assert.equal(await f.ready,'true');
  f.input('search','가족');assert.equal(f.element('benefits-search').hidden,false);assert.match(f.element('benefits-search').innerHTML,/data-benefit="family-album"/);
  await f.action({benefit:'family-album'});assert.equal(f.element('view-benefits').hidden,false);assert.match(f.element('benefit-detail').innerHTML,/가족의 이야기와 목소리/);assert.equal(f.element('breadcrumb-app').textContent,'SYNK WORLD');
  f.input('search','');assert.equal(f.element('benefits-search').hidden,true);assert.deepEqual(f.ids(),['world']);
});

test('member benefit clients launch only their own local preview after exact entitlement checks',async()=>{
  for(const id of ['fortune','rehearsal','family-album']){
    const calls=[],f=await fixture({initialAuth:account('benefit-'+id,[id]),bridgeOverrides:{getEnvironment:async()=>({...environment,productPreviewsAvailable:[id]}),openProductPreview:async actual=>{calls.push(actual);return {ok:true};},launch:async()=>assert.fail('must not use package launch')}});
    assert.equal(await f.ready,'true');assert.deepEqual(f.ids(),[]);assert.equal(f.element('primary-action').dataset.action,'product-preview');
    await f.action({benefit:id});assert.match(f.element('benefit-detail').innerHTML,new RegExp('data-benefit-preview="'+id+'"'));
    assert.doesNotMatch(f.element('benefit-detail').innerHTML,/플레저 개발 미리보기 열기/);
    await f.action({benefitPreview:id});assert.deepEqual(calls,[id]);
    const other=id==='rehearsal'?'family-album':'rehearsal';await f.action({benefit:other});assert.doesNotMatch(f.element('benefit-detail').innerHTML,/data-benefit-preview/);await f.action({benefitPreview:other});assert.deepEqual(calls,[id]);
    f.emit('auth',account('benefit-'+id,[],{sessionGeneration:2}));await f.action({benefitPreview:id});assert.deepEqual(calls,[id]);
  }
});

test('successful preview launches preserve per-account history and other view preferences after reopening',async()=>{
  for(const id of ['teacher','path','care','fortune','rehearsal','family-album']){
    const owner='preview-history-'+id;
    const options={initialAuth:account(owner,[id]),initialPreferences:JSON.stringify({selected:id,favorites:[id],density:'compact',lastLaunch:{world:123}}),bridgeOverrides:{getEnvironment:async()=>({...environment,teacherPreviewAvailable:true,productPreviewsAvailable:[id]}),openTeacherPreview:async()=>({ok:true}),openProductPreview:async()=>({ok:true})}};
    const f=await fixture(options);assert.equal(await f.ready,'true');await f.click('primary-action');
    const saved=JSON.parse(f.storage.get(viewKey(owner)));assert.ok(saved.lastLaunch[id]>0,id);assert.equal(saved.lastLaunch.world,123);assert.deepEqual(saved.favorites,[id]);assert.equal(saved.density,'compact');
    const reopened=await fixture({...options,initialPreferences:JSON.stringify(saved)});assert.equal(await reopened.ready,'true');assert.notEqual(reopened.element('last-launch').textContent,'기록 없음',id);assert.equal(reopened.storage.get(viewKey()),undefined);
  }
});

test('failed, revoked and previous-account preview responses cannot add launch history',async()=>{
  for(const id of ['teacher','fortune'])for(const scenario of ['failure','revoked','account-switch']){
    const operation=deferred(),owner='preview-race-'+id,oldPreferences=JSON.stringify({selected:id,favorites:[id],lastLaunch:{world:123}});
    const f=await fixture({initialAuth:account(owner,[id]),initialPreferences:oldPreferences,bridgeOverrides:{getEnvironment:async()=>({...environment,teacherPreviewAvailable:true,productPreviewsAvailable:[id]}),openTeacherPreview:()=>operation.promise,openProductPreview:()=>operation.promise}});
    assert.equal(await f.ready,'true');const pending=f.click('primary-action');
    if(scenario==='revoked')f.emit('auth',account(owner,[],{sessionGeneration:2}));
    if(scenario==='account-switch')f.emit('auth',account('next-account',[id],{sessionGeneration:2}));
    operation.resolve(scenario==='failure'?{ok:false,code:'PREVIEW_LAUNCH_FAILED'}:{ok:true});await pending;
    assert.equal(f.storage.get(viewKey(owner)),oldPreferences,scenario);assert.equal(f.storage.get(viewKey('next-account')),undefined);assert.equal(f.element('last-launch').textContent,scenario==='revoked'?'':'기록 없음');
  }
});

test('refresh recovers preview actions after an initial environment lookup failure',async()=>{
  let calls=0;const f=await fixture({initialAuth:account('environment-retry',['fortune']),bridgeOverrides:{getEnvironment:async()=>{if(++calls===1)throw Error('temporary');return {...environment,productPreviewsAvailable:['fortune']};},openProductPreview:async()=>({ok:true})}});
  assert.equal(await f.ready,'true');assert.equal(f.element('primary-action').disabled,true);await f.click('refresh');
  assert.equal(calls,2);assert.equal(f.element('primary-action').dataset.action,'product-preview');assert.equal(f.element('primary-action').disabled,false);assert.match(f.element('diagnostics').innerHTML,/독립 클라이언트/);assert.match(f.element('runtime-label').textContent,/Windows · x64/);
});

test('a late startup environment result cannot remove a recovered preview capability',async()=>{
  let calls=0;const startup=deferred(),f=await fixture({initialAuth:account('environment-race',['fortune']),bridgeOverrides:{getEnvironment:()=>++calls===1?startup.promise:Promise.resolve({...environment,productPreviewsAvailable:['fortune']}),openProductPreview:async()=>({ok:true})}});
  await f.click('refresh');startup.resolve(environment);assert.equal(await f.ready,'true');assert.equal(f.element('primary-action').dataset.action,'product-preview');assert.equal(f.element('primary-action').disabled,false);
});

test('preview app information uses its own published availability instead of denying every account connection',async()=>{
  const {MEMBER_BENEFITS}=await import('../renderer/benefits.mjs');
  for(const item of MEMBER_BENEFITS){const f=await fixture({initialAuth:account('availability-'+item.id,[item.id])});assert.equal(await f.ready,'true');await f.action({detail:'info'});assert.ok(f.element('detail-content').innerHTML.includes(item.availability));assert.doesNotMatch(f.element('detail-content').innerHTML,/운영 SYNK ID 동기화는 아직 제공하지 않습니다/);}
});

test('browser-only benefit previews retain public anchors and create no native launch history',async()=>{
  for(const id of ['care','fortune','rehearsal']){
    const f=await fixture({initialAuth:signedOut,native:false});assert.equal(await f.ready,'true');await f.action({benefit:id});
    const detail=f.element('benefit-detail').innerHTML;assert.ok(detail.includes(`href="https://synk.im/${id}/" target="_blank" rel="noopener noreferrer"`));assert.match(detail,/공개 웹에서 시작하기/);assert.match(detail,/공개 웹 · PC 개발판/);assert.doesNotMatch(detail,/data-benefit-preview/);assert.doesNotMatch(detail,/회원 무료 제공 예정/);assert.equal(f.storage.get(viewKey()),null);
  }
});

test('rendered native benefit clicks use the public app bridge and verified account destination',async()=>{
  const {createPublicApps}=require('../src/public-apps.cjs'),owner='00000000-0000-4000-8000-000000000001';
  for(const id of ['care','fortune','rehearsal']){
    const opened=[],calls=[],member=account(owner,[id]),publicApps=createPublicApps({clientId:'platform',mode:'development',accountStatus:()=>member,openExternal:async url=>opened.push(url)});
    const f=await fixture({initialAuth:member,bridgeOverrides:{getEnvironment:async()=>({...environment,publicAppsAvailable:publicApps.available()}),openPublicApp:async value=>{calls.push(value);return publicApps.open(value);}}});
    assert.equal(await f.ready,'true');await f.action({benefit:id});await f.clickPublicBenefit();
    assert.deepEqual(calls,[id]);assert.deepEqual(opened,[`https://synk.im/${id}/#synk-platform-account=${owner}`]);assert.ok(JSON.parse(f.storage.get(viewKey(owner))).lastLaunch[id]>0);
  }
});

test('native benefit controls never fall back to anchors when capability or entitlement is missing',async()=>{
  for(const scenario of ['no-environment-capability','empty-capability','no-bridge-method','guest','revoked']){
    let calls=0;const f=await fixture({initialAuth:scenario==='guest'?signedOut:account('restricted',scenario==='revoked'?[]:['care']),bridgeOverrides:{getEnvironment:async()=>({...environment,...(scenario==='no-environment-capability'?{}:{publicAppsAvailable:scenario==='empty-capability'?[]:['care']})}),...(scenario==='no-bridge-method'?{}:{openPublicApp:async()=>{calls++;return {ok:true};}})}});
    assert.equal(await f.ready,'true');await f.action({benefit:'care'});const control=f.publicBenefitControl();
    assert.equal(control.tag,'button',scenario);assert.equal(control.href,undefined,scenario);assert.equal(control.disabled,true,scenario);
    await f.clickPublicBenefit();await f.action({benefitPublic:'care'});assert.equal(calls,0,scenario);
  }
});

test('native benefit clicks retain the development guest catalogue without inventing an account',async()=>{
  const {createPublicApps}=require('../src/public-apps.cjs'),opened=[],publicApps=createPublicApps({clientId:'platform',mode:'development',accountStatus:()=>signedOut,openExternal:async url=>opened.push(url)});
  const f=await fixture({initialAuth:signedOut,bridgeOverrides:{getEnvironment:async()=>({...environment,clientId:'platform',nativeShell:true,publicAppsAvailable:publicApps.available()}),openPublicApp:publicApps.open}});
  assert.equal(await f.ready,'true');await f.action({benefit:'care'});await f.clickPublicBenefit();assert.deepEqual(opened,['https://synk.im/care/']);assert.deepEqual(f.ids().sort(),['world','messenger','path','pulse'].sort());
});

test('Messenger and teacher rights share one card while teaching action keeps its own permission',async()=>{
  const calls=[],initialPreferences=JSON.stringify({selected:'teacher',favorites:['teacher','messenger'],lastLaunch:{teacher:200,messenger:100}});
  const f=await fixture({initialAuth:account('dual-member',['messenger','teacher']),initialPreferences,initialClients:[{id:'messenger',canLaunch:true,status:'installed'}],bridgeOverrides:{getEnvironment:async()=>({...environment,teacherPreviewAvailable:true}),openTeacherPreview:async()=>{calls.push('teacher');return {ok:true};},launch:async id=>{calls.push(id);return {ok:true};}}});
  assert.equal(await f.ready,'true');assert.deepEqual(f.ids(),['messenger']);assert.equal(f.element('breadcrumb-app').textContent,'SYNK Workspace');assert.equal(f.element('teaching-action').hidden,false);assert.equal(f.element('teaching-action').disabled,false);
  f.input('search','교사');assert.deepEqual(f.ids(),['messenger']);f.input('search','');await f.action({filter:'favorites'});assert.deepEqual(f.ids(),['messenger']);
  await f.action({command:'teacher-preview',client:'teacher'});assert.deepEqual(calls,['teacher']);
  f.emit('auth',account('dual-member',['messenger'],{sessionGeneration:2}));assert.equal(f.element('teaching-action').hidden,true);await f.action({command:'teacher-preview',client:'teacher'});assert.deepEqual(calls,['teacher']);
});

test('native benefit clicks suppress duplicates and discard old-account launch completion',async()=>{
  for(const scenario of ['failure','revoked','account-switch']){
    const operation=deferred(),owner='public-race',oldPreferences=JSON.stringify({selected:'care',favorites:['care'],lastLaunch:{world:123}});let calls=0;
    const f=await fixture({initialAuth:account(owner,['care']),initialPreferences:oldPreferences,bridgeOverrides:{getEnvironment:async()=>({...environment,publicAppsAvailable:['care']}),openPublicApp:()=>{calls++;return operation.promise;}}});
    assert.equal(await f.ready,'true');await f.action({benefit:'care'});const pending=f.clickPublicBenefit();assert.equal(calls,1);assert.equal(f.publicBenefitControl().disabled,true);await f.clickPublicBenefit();await f.action({benefitPublic:'care'});assert.equal(calls,1);
    if(scenario==='revoked')f.emit('auth',account(owner,[],{sessionGeneration:2}));
    if(scenario==='account-switch')f.emit('auth',account('next-public-account',['care'],{sessionGeneration:2}));
    operation.resolve(scenario==='failure'?{ok:false,code:'PUBLIC_APP_OPEN_FAILED'}:{ok:true});await pending;
    assert.equal(f.storage.get(viewKey(owner)),oldPreferences,scenario);assert.equal(f.storage.get(viewKey('next-public-account')),undefined,scenario);
  }
});

test('retrying an unavailable signed-in library restores only server-confirmed apps and its saved view',async()=>{
  const owner='library-recovery',member=account(owner,['world','fortune']);let loads=0;
  const f=await fixture({initialAuth:{...member,library:{status:'unavailable',appIds:[]}},initialPreferences:JSON.stringify({selected:'fortune',favorites:['fortune'],lastLaunch:{fortune:123}}),bridgeOverrides:{accountRequest:async operation=>{assert.equal(operation,'load');loads++;f.emit('auth',{...member,library:{status:'unavailable',appIds:[]}});f.emit('auth',member);return {ok:true};}}});
  assert.equal(await f.ready,'true');assert.equal(f.element('library-retry').hidden,false);assert.deepEqual(f.ids(),[]);await f.click('library-retry');
  assert.equal(loads,1);assert.deepEqual(f.ids(),['world']);assert.equal(f.element('library-retry').hidden,true);assert.equal(f.element('breadcrumb-app').textContent,'SYNK 무료 운세');assert.equal(f.element('favorite').attributes.get('aria-pressed'),'true');assert.notEqual(f.element('last-launch').textContent,'기록 없음');
});

test('sign-in from a connection error restores the confirmed account library through actual handlers',async()=>{
  const f=await fixture({initialAuth:{...signedOut,status:'error',error:{message:'연결 확인 필요'}},bridgeOverrides:{authSignIn:async()=>{f.setAuth(account('recovered',['fortune']));return {ok:true};}}});
  assert.equal(await f.ready,'true');assert.deepEqual(f.ids(),[]);assert.equal(f.element('sign-in').disabled,false);await f.click('sign-in');
  assert.deepEqual(f.ids(),[]);assert.equal(f.element('account-label').textContent,'합성 recovered');assert.doesNotMatch(f.element('account-state').textContent,/연결 확인 필요/);assert.equal(f.element('library-empty').hidden,true);
});

test('a failed old library retry cannot replace a new account or expose its saved history',async()=>{
  const retry=deferred(),f=await fixture({initialAuth:account('old-retry',['fortune'],{library:{status:'unavailable',appIds:[]}}),initialPreferences:JSON.stringify({selected:'fortune',favorites:['fortune'],lastLaunch:{fortune:123}}),bridgeOverrides:{accountRequest:()=>retry.promise}});
  assert.equal(await f.ready,'true');const pending=f.click('library-retry');f.emit('auth',account('new-member',['world'],{sessionGeneration:2}));retry.reject(Error('old connection'));await pending;
  assert.deepEqual(f.ids(),['world']);assert.equal(f.element('account-label').textContent,'합성 new-member');assert.equal(f.element('last-launch').textContent,'기록 없음');assert.equal(f.element('favorite').attributes.get('aria-pressed'),'false');assert.doesNotMatch(f.element('account-state').textContent,/다시 확인/);
});

const retryableConnectionError=()=>({...signedOut,status:'error',error:{code:'AUTH_SERVER_UNAVAILABLE',message:'연결을 잠시 확인하지 못했어요.',retryable:true}});

const suiteCheckingError=()=>({...signedOut,status:'error',sessionGeneration:4,error:{code:'SUITE_UNAVAILABLE',message:'앱 계정 연결을 복구했어요. SYNK ID로 다시 로그인해 주세요.',retryable:true}});
test('suite checking retry explains the remaining failure in the account dialog without starting OAuth',async()=>{
  let loads=0,oauth=0;const f=await fixture({initialAuth:suiteCheckingError(),storageEntries:[['synthetic-local-draft','preserved']],bridgeOverrides:{
    accountRequest:async operation=>{assert.equal(operation,'load');loads++;return {ok:false,code:'SUITE_UNAVAILABLE'};},
    authSignIn:async()=>{oauth++;assert.fail('suite retry cannot start OAuth');}
  }});await f.ready;await f.click('account-button');await f.click('account-retry');
  assert.equal(loads,1);assert.equal(oauth,0);assert.equal(f.element('account-dialog').open,true);
  assert.match(f.element('account-state').textContent,/앱 계정 연결을 복구했어요/);
  assert.match(f.element('account-state').textContent,/새로 로그인/);
  assert.equal(f.element('account-retry').disabled,false);assert.equal(f.element('sign-in').textContent,'새로 로그인');
  assert.equal(f.storage.get('synthetic-local-draft'),'preserved');assert.equal(f.element('toast').hidden,true);
});
test('suite checking retry cannot append its old failure notice after a newer account arrives during status refresh',async()=>{
  const status=deferred(),statusEntered=deferred();let oauth=0;
  const f=await fixture({initialAuth:suiteCheckingError(),bridgeOverrides:{accountRequest:async()=>({ok:false,code:'SUITE_UNAVAILABLE'}),authSignIn:async()=>{oauth++;assert.fail('suite retry cannot start OAuth');}}});await f.ready;
  await f.click('account-button');f.bridge.authStatus=()=>{statusEntered.resolve();return status.promise;};
  const retry=f.click('account-retry');await statusEntered.promise;f.emit('auth',account('suite-new-account',['teacher'],{sessionGeneration:9}));
  status.resolve(suiteCheckingError());await retry;
  assert.equal(oauth,0);assert.deepEqual(f.ids(),['teacher']);assert.equal(f.element('account-label').textContent,'합성 suite-new-account');
  assert.equal(f.element('account-dialog').open,true);assert.equal(f.element('toast').hidden,true);
  assert.doesNotMatch(f.element('account-state').textContent,/새로 로그인|앱 계정 연결을 복구했어요/);
});
test('account dialog distinguishes preserving retry from a fresh OAuth choice only for retryable errors',async()=>{
  const retry=await fixture({initialAuth:retryableConnectionError(),bridgeOverrides:{accountRequest:async()=>({ok:true})}});await retry.ready;
  assert.equal(retry.element('account-retry').hidden,false);assert.equal(retry.element('account-retry').disabled,false);
  assert.equal(retry.element('sign-in').textContent,'새로 로그인');
  assert.match(retry.element('account-description').textContent,/연결을 다시 확인/);
  for(const [initial,native]of [[signedOut,true],[{...signedOut,status:'error',error:{code:'AUTH_REQUIRED',retryable:false}},true],[signedIn,true],[{...signedOut,status:'restoring'},true],[retryableConnectionError(),false]]){
    const f=await fixture({initialAuth:initial,native,bridgeOverrides:{accountRequest:async()=>assert.fail('hidden retry must not run')}});await f.ready;
    assert.equal(f.element('account-retry').hidden,true);await f.click('account-retry');
  }
});
test('account dialog preserving retry uses one load and no OAuth, then shows only the server-confirmed account',async()=>{
  let loads=0,oauth=0;const f=await fixture({initialAuth:retryableConnectionError(),storageEntries:[['synthetic-local-draft','preserved']],bridgeOverrides:{
    accountRequest:async operation=>{assert.equal(operation,'load');loads++;f.emit('auth',account('dialog-restored',['fortune']));return {ok:true};},
    authSignIn:async()=>{oauth++;assert.fail('preserving retry must not start OAuth');}
  }});await f.ready;await f.click('account-retry');
  assert.equal(loads,1);assert.equal(oauth,0);assert.deepEqual(f.ids(),[]);assert.equal(f.element('account-label').textContent,'합성 dialog-restored');
  assert.equal(f.storage.get('synthetic-local-draft'),'preserved');assert.equal(f.element('account-retry').hidden,true);
});
for(const kind of ['returned failure','IPC rejection'])test('account dialog retry keeps its recovery choice after '+kind,async()=>{
  let loads=0,oauth=0;const f=await fixture({initialAuth:retryableConnectionError(),storageEntries:[['synthetic-local-draft','preserved']],bridgeOverrides:{
    accountRequest:async operation=>{assert.equal(operation,'load');loads++;if(kind==='IPC rejection')throw Error('synthetic disconnected bridge');return {ok:false,error:{code:'AUTH_SERVER_UNAVAILABLE',retryable:true}};},
    authSignIn:async()=>{oauth++;return {ok:true};}
  }});await f.ready;
  for(let attempt=0;attempt<2;attempt++){await f.click('account-retry');assert.equal(f.element('account-retry').hidden,false);assert.equal(f.element('account-retry').disabled,false);assert.equal(f.element('sign-in').textContent,'새로 로그인');assert.deepEqual(f.ids(),[]);}
  assert.equal(loads,2);assert.equal(oauth,0);assert.equal(f.storage.get('synthetic-local-draft'),'preserved');
});
test('account dialog pending retry prevents duplicate loads and accidental OAuth',async()=>{
  const pending=deferred();let loads=0,oauth=0;const f=await fixture({initialAuth:retryableConnectionError(),bridgeOverrides:{accountRequest:()=>{loads++;return pending.promise;},authSignIn:async()=>{oauth++;return {ok:true};}}});await f.ready;
  const retry=f.click('account-retry');retry.catch(()=>{});assert.equal(f.element('account-retry').disabled,true);assert.equal(f.element('sign-in').disabled,true);
  await f.click('account-retry');await f.click('sign-in');assert.equal(loads,1);assert.equal(oauth,0);
  pending.resolve({ok:false,error:{retryable:true}});await retry;assert.equal(f.element('account-retry').disabled,false);assert.equal(f.element('sign-in').disabled,false);
});
for(const outcome of ['resolve','reject'])test('account dialog late retry '+outcome+' cannot overwrite a newer account',async()=>{
  const pending=deferred();pending.promise.catch(()=>{});let oauth=0;const f=await fixture({initialAuth:retryableConnectionError(),storageEntries:[[viewKey('earlier-account'),JSON.stringify({selected:'fortune',lastLaunch:{fortune:123}})]],bridgeOverrides:{accountRequest:()=>pending.promise,authSignIn:async()=>{oauth++;return {ok:true};}}});await f.ready;
  const retry=f.click('account-retry');f.emit('auth',account('dialog-new-account',['world'],{sessionGeneration:9}));
  if(outcome==='reject')pending.reject(Error('old connection'));else pending.resolve({ok:true,account:{synk_user_id:'earlier-account'}});await retry;
  assert.equal(oauth,0);assert.deepEqual(f.ids(),['world']);assert.equal(f.element('account-label').textContent,'합성 dialog-new-account');assert.equal(f.element('account-retry').hidden,true);assert.equal(f.element('toast').hidden,true);assert.equal(f.element('last-launch').textContent,'기록 없음');assert.doesNotMatch(f.element('account-state').textContent,/다시 확인/);
});
test('account dialog explicit fresh login still invokes OAuth once without a preserving load',async()=>{
  let loads=0,oauth=0;const f=await fixture({initialAuth:retryableConnectionError(),bridgeOverrides:{accountRequest:async()=>{loads++;return {ok:true};},authSignIn:async()=>{oauth++;f.setAuth(account('dialog-explicit-login',['fortune']));return {ok:true};}}});await f.ready;
  assert.equal(f.element('sign-in').textContent,'새로 로그인');await f.click('sign-in');assert.equal(oauth,1);assert.equal(loads,0);assert.deepEqual(f.ids(),[]);assert.equal(f.element('account-label').textContent,'합성 dialog-explicit-login');
});
