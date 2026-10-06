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
async function fixture({initialAuth=signedOut,initialClients=[waitingClient],bridgeOverrides={},initialPreferences=null,personalPreferences=null,storageEntries=[]}={}) {
  const nodes=new Map(),subscriptions=new Map(),documentHandlers=new Map(),ready=deferred();let currentAuth=initialAuth;
  function element(id) {
    if(!nodes.has(id)) {
      const handlers=new Map(),attributes=new Map();
      nodes.set(id,{id,hidden:false,disabled:false,value:'',textContent:'',innerHTML:'',dataset:{},style:{},
        classList:{toggle(){},add(){},remove(){}},firstElementChild:{textContent:''},
        setAttribute:(name,value)=>attributes.set(name,String(value)),removeAttribute:name=>attributes.delete(name),
        addEventListener:(name,callback)=>handlers.set(name,callback),focus(){},select(){},showModal(){this.open=true;},close(){this.open=false;},handlers,attributes});
    }
    return nodes.get(id);
  }
  const root=element('html');root.dataset=new Proxy({}, {set(object,key,value){object[key]=value;if(key==='ready')ready.resolve(value);return true;}});
  const document={getElementById:element,documentElement:root,activeElement:null,
    querySelectorAll:selector=>selector==='dialog[open]'?[...nodes.values()].filter(node=>node.open):[],
    querySelector:selector=>selector==='.footer-progress'?element('footer-progress'):selector==='dialog[open]'?[...nodes.values()].find(node=>node.open):null,
    addEventListener:(name,callback)=>documentHandlers.set(name,callback)};
  const subscribe=(channel,callback)=>{const list=subscriptions.get(channel)||[];list.push(callback);subscriptions.set(channel,list);return ()=>{};};
  const bridge={getEnvironment:async()=>environment,getClients:async()=>initialClients,authStatus:async()=>currentAuth,
    onAuthChanged:callback=>subscribe('auth',callback),onClientsChanged:callback=>subscribe('clients',callback),onClientProgress:callback=>subscribe('progress',callback),...bridgeOverrides};
  const owner=initialAuth.signedIn?initialAuth.account?.synk_user_id:null;
  const storage=new Map([[viewKey(owner),initialPreferences],[personalKey(owner),personalPreferences],...storageEntries]);
  const modules={};for(const file of ['state','personalization','library','benefits'])modules[file]=await import('../renderer/'+file+'.mjs');
  const source=fs.readFileSync(path.join(__dirname,'../renderer/launcher.mjs'),'utf8').replace(/^import \{([^}]+)\} from '\.\/(state|personalization|library|benefits)\.mjs';/gm,(_all,names,file)=>'const {'+names+'}=globalThis.rendererModules.'+file+';');
  const context={rendererModules:modules,SynkAtlasPersonalization:personalEngine,document,window:{addEventListener(){}},synkDesktop:bridge,
    localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},setTimeout:()=>0,clearTimeout(){},Intl,Date};
  vm.createContext(context);vm.runInContext(source,context,{filename:'desktop/renderer/launcher.mjs'});
  return {element,bridge,storage,ready:ready.promise,setAuth:value=>{currentAuth=value;},
    ids:()=>[...element('app-list').innerHTML.matchAll(/data-app="([^"]+)"/g)].map(match=>match[1]),
    emit(channel,value){if(channel==='auth')currentAuth=value;for(const callback of subscriptions.get(channel)||[])callback(value);},
    async click(id){const callback=element(id).handlers.get('click');assert.equal(typeof callback,'function');await callback();},
    async action(dataset){await documentHandlers.get('click')({target:{closest:()=>({dataset})}});},
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
  assert.match(f.element('detail-content').innerHTML,/로컬 MVP/);assert.doesNotMatch(f.element('detail-content').innerHTML,/사내 대화/);
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

test('signed out exposes only public WORLD, never the complete catalog',async()=>{
  const f=await fixture({initialPreferences:JSON.stringify({selected:'messenger',favorites:['messenger']})});assert.equal(await f.ready,'true');assert.deepEqual(f.ids(),['world']);assert.doesNotMatch(f.element('download-list').innerHTML,/SYNK Messenger/);assert.equal(f.element('teacher-web-link').hidden,true);await f.action({app:'messenger'});assert.equal(f.element('breadcrumb-app').textContent,'SYNK WORLD');
});
for(const status of ['restoring','signing-in','error'])test(status+' never borrows guest or prior library',async()=>{
  const f=await fixture({initialAuth:{...signedOut,status}});assert.equal(await f.ready,'true');assert.deepEqual(f.ids(),[]);assert.equal(f.element('app-detail').hidden,true);assert.equal(f.element('primary-action').disabled,true);assert.equal(f.element('recommendation').hidden,true);
});
test('signed-in missing, unavailable or empty library fails closed',async()=>{
  for(const library of [undefined,{status:'unavailable',appIds:['messenger']},{status:'ready',appIds:[]}]){const f=await fixture({initialAuth:account('staff',['messenger'],{library})});assert.equal(await f.ready,'true');assert.deepEqual(f.ids(),[]);assert.equal(f.element('app-detail').hidden,true);assert.doesNotMatch(f.element('download-list').innerHTML,/SYNK (WORLD|Messenger)/);}
});
test('verified account apps define library, selection and installation rows',async()=>{
  for(const [id,appIds]of [['student',['world']],['teacher',['teacher']],['staff',['messenger']],['customer',['pulse']]]){const f=await fixture({initialAuth:account(id,appIds),initialPreferences:JSON.stringify({selected:'partners',favorites:['partners']})});assert.equal(await f.ready,'true');assert.deepEqual(f.ids().sort(),[...appIds].sort());assert.equal(f.element('breadcrumb-app').textContent,({student:'SYNK WORLD',teacher:'SYNK WORLD · 교사',staff:'SYNK Messenger',customer:'SYNK PULSE'})[id]);for(const forbidden of ['WORLD','Messenger'].filter(name=>!appIds.includes(name==='WORLD'?'world':'messenger')))assert.doesNotMatch(f.element('download-list').innerHTML,new RegExp('SYNK '+forbidden));}
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
test('granted planned app remains a plan and cannot invoke launch bridge',async()=>{
  let called=0;const f=await fixture({initialAuth:account('customer',['pulse']),initialClients:[{id:'pulse',canLaunch:true,installer:{canPrepare:true}}],bridgeOverrides:{launch:async()=>{called++;return {ok:true};}}});assert.equal(await f.ready,'true');assert.equal(f.element('primary-action').disabled,true);assert.equal(f.element('primary-action').dataset.action,'none');assert.match(f.element('detail-content').innerHTML,/PULSE 고객/);assert.doesNotMatch(f.element('download-list').innerHTML,/SYNK PULSE/);await f.click('primary-action');assert.equal(called,0);assert.deepEqual(f.ids(),['pulse']);
});
test('teacher preview needs server library and explicit development capability',async()=>{
  let calls=0;const opts={getEnvironment:async()=>({...environment,teacherPreviewAvailable:true}),openTeacherPreview:async()=>{calls++;return {ok:true};}};const f=await fixture({initialAuth:account('teacher',['teacher']),bridgeOverrides:opts});assert.equal(await f.ready,'true');assert.equal(f.element('primary-action').dataset.action,'teacher-preview');await f.click('primary-action');assert.equal(calls,1);assert.equal(f.element('last-launch').textContent,'기록 없음');const old=await fixture({initialAuth:account('teacher',['teacher']),bridgeOverrides:{openTeacherPreview:opts.openTeacherPreview}});assert.equal(await old.ready,'true');assert.equal(old.element('primary-action').disabled,true);await old.click('primary-action');assert.equal(calls,1);
});
test('self-declared teacher interest changes presentation without granting apps',async()=>{
  const f=await fixture({initialAuth:signedIn});assert.equal(await f.ready,'true');await savePersonal(f,{consent:false});assert.match(f.element('personal-message').textContent,/동의/);assert.equal(f.storage.get(personalKey('student-a')),null);f.element('personal-consent').checked=true;f.submitPersonal();assert.equal(f.element('html').dataset.textSize,'large');assert.deepEqual(f.ids(),['world']);assert.doesNotMatch(f.element('recommendation').innerHTML,/data-personal-app="(?:teacher|studio)"/);assert.ok(f.storage.get(personalKey('student-a')));await f.click('personal-clear');assert.equal(f.storage.has(personalKey('student-a')),false);assert.equal(f.element('html').dataset.textSize,'standard');assert.deepEqual(f.ids(),['world']);
});
test('account switch clears selection, favorites, search, dialogs and personal settings',async()=>{
  const a=account('staff-a',['messenger']),b=account('student-b',['world'],{sessionGeneration:2});const f=await fixture({initialAuth:a,initialPreferences:JSON.stringify({selected:'messenger',favorites:['messenger'],lastLaunch:{messenger:1000}})});assert.equal(await f.ready,'true');await savePersonal(f,{context:'team'});await f.click('personal-open');f.input('search','메신저');f.emit('auth',b);assert.deepEqual(f.ids(),['world']);assert.equal(f.element('search').value,'');assert.equal(f.element('personal-dialog').open,false);assert.equal(f.element('last-launch').textContent,'기록 없음');assert.equal(f.element('favorite').attributes.get('aria-pressed'),'false');assert.equal(f.element('html').dataset.textSize,'standard');assert.equal(f.element('recommendation').hidden,true);f.emit('auth',a);assert.equal(f.element('breadcrumb-app').textContent,'SYNK Messenger');assert.equal(f.element('favorite').attributes.get('aria-pressed'),'true');assert.equal(f.element('html').dataset.textSize,'large');
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
  f.emit('auth',member);assert.deepEqual(f.ids(),['messenger']);assert.equal(f.element('breadcrumb-app').textContent,'SYNK Messenger');assert.equal(f.element('favorite').attributes.get('aria-pressed'),'true');assert.equal(f.storage.get(viewKey('team-refresh')),stored);
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

test('retired Studio and SHIFT selections stay hidden and cannot launch or grant Messenger',async()=>{for(const id of ['studio','shift']){let calls=0;const f=await fixture({initialAuth:account('legacy-'+id,[id]),initialPreferences:JSON.stringify({selected:id,favorites:[id]}),initialClients:[{id,canLaunch:true}],bridgeOverrides:{getEnvironment:async()=>({...environment,productPreviewsAvailable:['path','shift']}),openProductPreview:async()=>{calls++;},launch:async()=>{calls++;}}});assert.equal(await f.ready,'true');assert.deepEqual(f.ids(),[]);assert.equal(f.element('app-detail').hidden,true);await f.action({app:id});await f.action({command:'product-preview',client:id});await f.action({command:'launch',client:'messenger'});assert.equal(calls,0);assert.doesNotMatch(f.element('download-list').innerHTML,/Messenger/);}});
test('Messenger workroom lists production review and AI practice without duplicate apps',async()=>{const f=await fixture({initialAuth:account('workroom-member',['messenger','studio','shift']),initialPreferences:JSON.stringify({selected:'shift',favorites:['studio','shift']})});assert.equal(await f.ready,'true');assert.deepEqual(f.ids(),['messenger']);assert.equal(f.element('breadcrumb-app').textContent,'SYNK Messenger');assert.match(f.element('detail-content').innerHTML,/제작 데스크/);assert.match(f.element('detail-content').innerHTML,/게시 전 점검/);assert.match(f.element('detail-content').innerHTML,/AI 업무 연습/);assert.equal(f.element('favorite').attributes.get('aria-pressed'),'false');});

test('public benefit introductions never grant a guest app or a preview action',async()=>{
  let calls=0;const f=await fixture({initialAuth:signedOut,bridgeOverrides:{getEnvironment:async()=>({...environment,productPreviewsAvailable:['care','fortune','rehearsal','family-album']}),openProductPreview:async()=>{calls++;return {ok:true};}}});
  assert.equal(await f.ready,'true');await f.action({view:'benefits'});
  assert.equal(f.element('view-benefits').hidden,false);assert.deepEqual(f.ids(),['world']);
  for(const id of ['care','fortune','rehearsal','family-album']){
    await f.action({benefit:id});assert.equal(f.element('benefit-detail').hidden,false);
    assert.match(f.element('benefit-detail').innerHTML,/회원 무료 제공 예정/);
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
  await f.action({benefit:'family-album'});assert.equal(f.element('view-benefits').hidden,false);assert.match(f.element('benefit-detail').innerHTML,/사진 뒤의 이야기/);assert.equal(f.element('breadcrumb-app').textContent,'SYNK WORLD');
  f.input('search','');assert.equal(f.element('benefits-search').hidden,true);assert.deepEqual(f.ids(),['world']);
});

test('member benefit clients launch only their own local preview after exact entitlement checks',async()=>{
  for(const id of ['fortune','rehearsal','family-album']){
    const calls=[],f=await fixture({initialAuth:account('benefit-'+id,[id]),bridgeOverrides:{getEnvironment:async()=>({...environment,productPreviewsAvailable:[id]}),openProductPreview:async actual=>{calls.push(actual);return {ok:true};},launch:async()=>assert.fail('must not use package launch')}});
    assert.equal(await f.ready,'true');assert.deepEqual(f.ids(),[id]);assert.equal(f.element('primary-action').dataset.action,'product-preview');
    await f.action({benefit:id});assert.match(f.element('benefit-detail').innerHTML,new RegExp('data-benefit-preview="'+id+'"'));
    assert.doesNotMatch(f.element('benefit-detail').innerHTML,/플레저 개발 미리보기 열기/);
    await f.action({benefitPreview:id});assert.deepEqual(calls,[id]);
    const other=id==='rehearsal'?'family-album':'rehearsal';await f.action({benefit:other});assert.doesNotMatch(f.element('benefit-detail').innerHTML,/data-benefit-preview/);await f.action({benefitPreview:other});assert.deepEqual(calls,[id]);
    f.emit('auth',account('benefit-'+id,[],{sessionGeneration:2}));await f.action({benefitPreview:id});assert.deepEqual(calls,[id]);
  }
});
