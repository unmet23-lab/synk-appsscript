'use strict';
// Run only the explicit offside candidate in isolated AppData. HTTPS is served
// from a synthetic in-memory protocol; no provider/login/API request is allowed.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process'),asar=require('@electron/asar');
const args=Object.fromEntries(process.argv.slice(2).map(value=>{const m=/^--(client|candidate|out|runtime-base)=(.+)$/.exec(value);if(!m)throw Error('Expected --client=platform|messenger --candidate=dir --out=dir');return [m[1],m[2]];}));
if(!['platform','messenger','world'].includes(args.client)||!args.candidate||!args.out)throw Error('Explicit candidate and output are required');
const root=path.resolve(__dirname,'../..'),candidate=path.resolve(args.candidate),out=path.resolve(args.out),client=args.client;
for(const value of [candidate,out])if(!path.relative(root,value).startsWith('.tmp'+path.sep))throw Error('Candidate and output must remain within workspace .tmp');
const basename=({messenger:'SYNKMessengerPreview',platform:'SYNKPlatformPreview',world:'SYNKWorldPreview'})[client],installed=path.join(process.env.LOCALAPPDATA,'Programs',basename),native=path.join(out,client+'-native');
if(fs.existsSync(native))throw Error('Refusing to overwrite a smoke package');fs.mkdirSync(native,{recursive:true});
function copyRuntime(source,destination){for(const item of fs.readdirSync(source,{withFileTypes:true})){if(item.name==='clients'||item.name==='app.asar'||item.name==='synk-install.json')continue;const from=path.join(source,item.name),to=path.join(destination,item.name);if(item.isDirectory()){fs.mkdirSync(to,{recursive:true});copyRuntime(from,to);}else if(item.isFile())fs.copyFileSync(from,to);}}
if(!args['runtime-base'])throw Error('Explicit owned runtime-base required');const owned=path.resolve(args['runtime-base']);if(!path.relative(root,owned).startsWith('.tmp'+path.sep))throw Error('Runtime reuse must be owned');function linkRuntime(source,dest){for(const item of fs.readdirSync(source,{withFileTypes:true})){if(['clients','app.asar','synk-install.json'].includes(item.name))continue;const from=path.join(source,item.name),to=path.join(dest,item.name);if(item.isDirectory()){fs.mkdirSync(to,{recursive:true});linkRuntime(from,to);}else if(item.isFile())fs.linkSync(from,to);}}linkRuntime(owned,native);for(const file of ['app.asar','synk-install.json'])fs.copyFileSync(path.join(candidate,'resources',file),path.join(native,'resources',file));
const archive=path.join(native,'resources/app.asar'),runtime=JSON.parse(asar.extractFile(archive,'runtime.json')),sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),before=sha(archive);
const isolation=path.join(out,client+'-isolated');for(const name of ['Roaming','Local','Temp'])fs.mkdirSync(path.join(isolation,name),{recursive:true});
const configuration={appData:path.join(isolation,'Roaming'),entry:client==='messenger'?runtime.entry.replace('tab=messenger','tab=teaching'):runtime.entry,archive,client,prefix:'SYNK_WORKSPACE_CONNECT '};
function observe(config){
 const {app}=require('electron');app.setPath('appData',config.appData);const attempted=[],fixtureCalls=[];let result,finished=false;
 const subject='synthetic-native-subject',owner='11111111-1111-4111-8111-111111111111',classId='22222222-2222-4222-8222-222222222222';
 const storeModule=require(app.getAppPath()+'/src/auth-store.cjs'),originalStore=storeModule.createTokenStore;
 storeModule.createTokenStore=options=>{if(options.configFingerprint!=='synthetic-only'&&(['world','platform'].includes(config.client)&&options.scope==='im.synk.'+config.client+'.preview'||config.client==='messenger'&&options.scope==='im.synk.messenger.preview.teacher'))return {available:()=>true,load:async()=>({refreshToken:'synthetic-fixture-refresh',subject}),save:async()=>{},clear:async()=>{}};return originalStore(options);};

 // Empty isolated vaults should never fetch. Fail closed if startup regresses.
 globalThis.fetch=async(url,options={})=>{const target=new URL(url),body=options.body instanceof URLSearchParams?Object.fromEntries(options.body):options.body?JSON.parse(options.body):null;let data;
  if(target.pathname==='/auth/v1/oauth/token')data={token_type:'bearer',access_token:'synthetic-fixture-access',refresh_token:'synthetic-fixture-refresh-rotated',expires_in:3600};
  else if(target.pathname==='/auth/v1/user')data={id:subject};
  else if(target.pathname==='/functions/v1/synk-account')data={ok:true,account:{synk_user_id:owner,status:'active',profile:{display_name:'Synthetic fixture'}},memberships:[],entitlements:[],sessions:[]};
  else if(target.pathname.endsWith('/enrollment/preview'))data={ok:true,invite:{className:'Synthetic class',learnerLabel:'Synthetic student',expiresAt:'2099-01-01'}};
  else if(target.pathname.endsWith('/enrollment/claim'))data={ok:true,linked:true,classId,learnerId:owner,sharing:{enabled:false,revision:1},townSharing:{enabled:false,revision:1}};
  else if(target.pathname.endsWith('/teacher/invites'))data={ok:true,invite:{token:'a'.repeat(32),expiresAt:'2099-01-01',access_token:'must-redact'},access_token:'must-redact',token:'must-redact'};
  else if(target.pathname.endsWith('/classes'))data={ok:true,classes:[]};
  else{attempted.push(target.pathname);throw Error('QA_NETWORK_BLOCKED');}
  fixtureCalls.push({path:target.pathname,body});return new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
 };
 app.on('browser-window-created',(_event,window)=>{
  window.show=()=>{};window.showInactive=()=>{};
  const contents=window.webContents;
  if(config.client!=='platform')contents.session.protocol.handle(config.client==='messenger'?'https':'http',request=>{
   if(request.url!==config.entry){attempted.push(request.url);return new Response('blocked',{status:403});}
   return new Response('<!doctype html><html><head><title>SYNK Workspace native fixture</title></head><body><h1>Native teacher bridge fixture</h1></body></html>',{headers:{'Content-Type':'text/html','Content-Security-Policy':"default-src 'none'; style-src 'none'; object-src 'none'; frame-ancestors 'none'"}});
  });
  contents.once('did-finish-load',async()=>{
   try{
    result=await contents.executeJavaScript(`(async()=>{const desktop=window.synkDesktop;const base={url:location.href,node:typeof require,environment:await desktop.getEnvironment(),teacherMethods:Object.keys(desktop.teacher||{}),unsafeLaunch:await desktop.launch('../cmd')};if(${JSON.stringify(config.client)}==='messenger'){base.teacherEnvironment=await desktop.teacher.getEnvironment();base.teacherStatus=await desktop.teacher.authStatus();base.denied=await desktop.teacher.accountRequest('classroom',{operation:'townCommand'});base.emptyClasses=await desktop.teacher.accountRequest('classroom',{operation:'classes'});}return base;})()`);
    if(['world','platform'].includes(config.client)){for(let i=0;i<60;i++){if(await contents.executeJavaScript('window.synkDesktop.authStatus().then(s=>s.signedIn)'))break;await new Promise(r=>setTimeout(r,50));}result.enrollment=await contents.executeJavaScript(`(async()=>({preview:await window.synkDesktop.accountRequest('classroom',{operation:'enrollmentPreview',body:{token:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'}}),claim:await window.synkDesktop.accountRequest('classroom',{operation:'enrollmentClaim',body:{token:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',confirm:true}})}))()`);}
    if(config.client==='messenger'){for(let i=0;i<60;i++){if(await contents.executeJavaScript('window.synkDesktop.teacher.authStatus().then(s=>s.signedIn)'))break;await new Promise(r=>setTimeout(r,50));}result.invitation=await contents.executeJavaScript(`window.synkDesktop.teacher.accountRequest('classroom',{operation:'enrollmentInvite',classId:'22222222-2222-4222-8222-222222222222',body:{learnerId:'11111111-1111-4111-8111-111111111111'}})`);}
    const catalog=require(app.getAppPath()+'/src/catalog.cjs');result.visibleProductName=catalog.identity(config.client,'development').name;
    const ok=result.node==='undefined'&&result.environment.clientId===config.client&&result.unsafeLaunch.code==='UNKNOWN_CLIENT'&&app.isPackaged&&app.getAppPath()===config.archive&&app.getPath('userData').startsWith(config.appData+require('node:path').sep)&&!window.isVisible()&&attempted.length===0&&(config.client!=='messenger'||result.teacherEnvironment.clientId==='teacher'&&result.teacherEnvironment.hostClientId==='messenger'&&result.teacherStatus.configured===true&&result.teacherStatus.configured===true&&result.denied.error?.code==='INVALID_REQUEST'&&(result.emptyClasses.ok===true||result.emptyClasses.error?.code==='AUTH_REQUIRED')&&result.invitation?.invite?.token==='a'.repeat(32)&&result.invitation?.access_token===undefined&&result.invitation?.token===undefined&&result.invitation?.invite?.access_token===undefined);
    if(config.client==='messenger')result.studentEnrollmentDenied=await contents.executeJavaScript(`(async()=>({preview:await window.synkDesktop.teacher.accountRequest('classroom',{operation:'enrollmentPreview',body:{token:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'}}),claim:await window.synkDesktop.teacher.accountRequest('classroom',{operation:'enrollmentClaim',body:{token:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',confirm:true}})}))()`);
    const finalOk=ok&&(!['world','platform'].includes(config.client)||result.enrollment?.preview?.ok===true&&result.enrollment?.claim?.linked===true&&result.enrollment.claim.sharing.enabled===false)&&(config.client!=='messenger'||result.studentEnrollmentDenied?.preview?.error?.code==='INVALID_REQUEST'&&result.studentEnrollmentDenied?.claim?.error?.code==='INVALID_REQUEST');
    process.stdout.write(config.prefix+JSON.stringify({ok:finalOk,client:config.client,packaged:app.isPackaged,visible:window.isVisible(),profileIsolated:app.getPath('userData').startsWith(config.appData+require('node:path').sep),providerRequests:attempted,syntheticFixtureCalls:fixtureCalls,...result})+'\n');finished=true;setTimeout(()=>app.exit(finalOk?0:1),200);
   }catch(error){process.stdout.write(config.prefix+JSON.stringify({ok:false,error:error.message,providerRequests:attempted})+'\n');finished=true;}
  });
 });
 return {appData:app.getPath('appData'),archive:app.getAppPath()};
}
const child=spawn(path.join(native,basename+'.exe'),['--synk-smoke','--inspect-brk=127.0.0.1:0',...(client==='messenger'?['--view=teaching']:[])],{cwd:native,windowsHide:true,env:{...process.env,APPDATA:configuration.appData,LOCALAPPDATA:path.join(isolation,'Local'),TEMP:path.join(isolation,'Temp'),TMP:path.join(isolation,'Temp')},stdio:['ignore','pipe','pipe']});
let stdout='',stderr='',ws,connected=false,sequence=0,injected=false,error=null;const pending=new Map();
const rpc=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
function connect(url){ws=new WebSocket(url);ws.addEventListener('open',async()=>{await rpc('Debugger.enable');await rpc('Runtime.runIfWaitingForDebugger');});ws.addEventListener('message',async event=>{const message=JSON.parse(event.data);if(message.id){const p=pending.get(message.id);if(p){pending.delete(message.id);message.error?p.reject(Error(message.error.message)):p.resolve(message.result);}return;}if(message.method==='Debugger.paused'&&!injected){injected=true;try{const result=await rpc('Debugger.evaluateOnCallFrame',{callFrameId:message.params.callFrames[0].callFrameId,expression:'('+observe.toString()+')('+JSON.stringify(configuration)+')',returnByValue:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));await rpc('Debugger.resume');}catch(e){error=e.message;child.kill('SIGKILL');}}});}
const timer=setTimeout(()=>{error='native smoke timeout';child.kill('SIGKILL');},35000);
child.stdout.on('data',data=>{stdout+=data;if(stdout.includes(configuration.prefix))ws?.close();});child.stderr.on('data',data=>{stderr+=data;const match=stderr.match(/Debugger listening on (ws:\/\/127\.0\.0\.1:\d+\/[^\s]+)/);if(match&&!connected){connected=true;connect(match[1]);}});child.on('error',e=>{error=e.message;});
child.on('close',code=>{clearTimeout(timer);ws?.close();let result;try{result=JSON.parse(stdout.split(/\r?\n/).find(line=>line.startsWith(configuration.prefix)).slice(configuration.prefix.length));}catch{}
 const report={createdAt:new Date().toISOString(),ok:code===0&&result?.ok===true&&!error&&sha(archive)===before,client,candidate,archive,asarSha256:before,packageBytesUnchanged:sha(archive)===before,code,error,result,realAuthenticationPerformed:false,realProfileTouched:false,installed:false,smokeSource:__filename,...(!result?.ok?{stderr:stderr.slice(-2000),stdout:stdout.slice(-1000)}:{})};
 fs.writeFileSync(path.join(out,client+'-smoke.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(!report.ok)process.exitCode=1;
});
